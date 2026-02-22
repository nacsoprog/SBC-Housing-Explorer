import os
import pandas as pd
from pathlib import Path

from rapidfireai import Experiment
from rapidfireai.automl import List, RFLangChainRagSpec, RFGridSearch
from rapidfireai.automl.model_config import RFOpenAIAPIModelConfig

# For LangChain RAG specifics
from langchain_community.document_loaders import JSONLoader, DirectoryLoader
from langchain_text_splitters import RecursiveCharacterTextSplitter
from langchain_huggingface import HuggingFaceEmbeddings

from dotenv import load_dotenv
load_dotenv()

dataset_dir = Path("datasets/housing_market")

def metadata_extractor(record, metadata):
    return {"corpus_id": int(record.get("_id"))}

# 1. Define the RAG Knobs (Top-K: 3 vs 5)
rag_pipeline = RFLangChainRagSpec(
    document_loader=DirectoryLoader(
        path=str(dataset_dir),
        glob="*.jsonl",
        loader_cls=JSONLoader,
        loader_kwargs={
            "jq_schema": ".",
            "content_key": "text",
            "metadata_func": metadata_extractor,
            "json_lines": True,
            "text_content": False,
        },
    ),
    text_splitter=RecursiveCharacterTextSplitter(chunk_size=500, chunk_overlap=0),
    embedding_cls=HuggingFaceEmbeddings,
    embedding_kwargs={"model_name": "sentence-transformers/all-MiniLM-L6-v2"},
    search_type="similarity",
    search_kwargs={"k": List([3, 5])}, # Variable 1: How many communities to pull
    enable_gpu_search=False # CPU friendly FAISS
)

# 2. Define the Groq Models
api_key = os.getenv("GROQ_API_KEY")
base_url = "https://api.groq.com/openai/v1"

models = [
    "llama-3.3-70b-versatile",
    "llama-3.2-3b-preview",
    "gemma2-9b-it"
]

api_configs = []
for m in models:
    cfg = RFOpenAIAPIModelConfig(
        client_config={"api_key": api_key, "base_url": base_url},
        model_config={"model": m, "temperature": 0.1, "max_completion_tokens": 256},
        rag=rag_pipeline,
        rpm_limit=15,
        tpm_limit=10000,
    )
    api_configs.append(cfg)

# 3. Postprocess and Eval Fns
def sample_preprocess_fn(batch, rag, prompt_manager) -> dict:
    all_context = rag.get_context(batch_queries=batch["text"], serialize=False)
    retrieved_documents = [[int(doc.metadata["corpus_id"]) for doc in docs] for docs in all_context]
    serialized_context = rag.serialize_documents(all_context)
    batch["query_id"] = [int(qid) for qid in batch["_id"]]
    
    return {
        "prompts": [
            [
                {"role": "system", "content": "You are a housing policy advisor. Given the specific context, recommend the EXACT community names that match the user's constraints. DO NOT mention communities outside the text."},
                {"role": "user", "content": f"Context:\\n{context}\\n\\nQuestion: {question}"}
            ]
            for question, context in zip(batch["text"], serialized_context)
        ],
        "retrieved_documents": retrieved_documents,
        **batch,
    }

def sample_postprocess_fn(batch) -> dict:
    qrels = pd.read_csv(str(dataset_dir / "qrels.tsv"), sep="\\t")
    batch["ground_truth_documents"] = [
        qrels[qrels["query-id"] == qid]["corpus-id"].tolist()
        for qid in batch["query_id"]
    ]
    return batch

def sample_compute_metrics_fn(batch) -> dict:
    total_queries = len(batch["text"])
    recalls = []
    # This is rough proxy for NDCG based on simple intersection
    for pred, gt in zip(batch["retrieved_documents"], batch["ground_truth_documents"]):
        expected_set = set(gt)
        retrieved_set = set(pred)
        recall = len(expected_set.intersection(retrieved_set)) / len(expected_set) if len(expected_set) > 0 else 0
        recalls.append(recall)
        
    return {
        "Total": {"value": total_queries},
        "Recall@TopK": {"value": sum(recalls)/total_queries}
    }

def sample_accumulate_metrics_fn(aggregated_metrics) -> dict:
    num_queries_per_batch = [m["value"] for m in aggregated_metrics["Total"]]
    total_queries = sum(num_queries_per_batch)
    metric_val = sum(m["value"] * queries for m, queries in zip(aggregated_metrics["Recall@TopK"], num_queries_per_batch)) / total_queries
    
    return {
        "Total": {"value": total_queries},
        "Recall@TopK": {"value": metric_val, "is_algebraic": True, "value_range": (0, 1)}
    }

config_set = {
    "pipeline": List(api_configs),
    "batch_size": 2, # Small batch for LLM API limits
    "preprocess_fn": sample_preprocess_fn,
    "postprocess_fn": sample_postprocess_fn,
    "compute_metrics_fn": sample_compute_metrics_fn,
    "accumulate_metrics_fn": sample_accumulate_metrics_fn,
}

config_group = RFGridSearch(config_set)

# Execute!
def run():
    print("Initializing RapidFire AI Experiment: Groq Models Eval...")
    experiment = Experiment(experiment_name="housing-groq-eval", mode="evals")
    
    from datasets import load_dataset
    hf_dataset = load_dataset("json", data_files=str(dataset_dir / "queries.jsonl"), split="train")
    
    print("Running RapidFire grid search execution...")
    try:
        results = experiment.run_evals(
            config_group=config_group,
            dataset=hf_dataset,
            num_actors=1,
            num_shards=1
        )
        print("Results generated successfully!")
        
        results_df = pd.DataFrame([
            {k: v['value'] if isinstance(v, dict) and 'value' in v else v for k, v in {**metrics_dict, 'run_id': run_id, 'model': str(run_id).split('-')[-2] if '-' in str(run_id) else 'unknown'}.items()}
            for run_id, (_, metrics_dict) in results.items()
        ])
        results_df.to_csv('datasets/housing_market/results.csv', index=False)
        print(results_df.to_string())
        
    except Exception as e:
        import traceback
        print("RapidFire execution failed. Traceback:")
        traceback.print_exc()
    finally:
        experiment.end()

if __name__ == "__main__":
    run()
