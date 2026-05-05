import sys
import os
import logging
import pandas as pd
import torch
from sklearn.model_selection import train_test_split
from transformers import AutoTokenizer, AutoModelForSequenceClassification, TrainingArguments, Trainer
from transformers import DataCollatorWithPadding

# Add project root to path
sys.path.append(os.getcwd())

# Setup Logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

class LegalDataset(torch.utils.data.Dataset):
    def __init__(self, encodings, labels):
        self.encodings = encodings
        self.labels = labels

    def __getitem__(self, idx):
        item = {key: torch.tensor(val[idx]) for key, val in self.encodings.items()}
        item['labels'] = torch.tensor(self.labels[idx])
        return item

    def __len__(self):
        return len(self.labels)

# Compute project root
_PROJECT_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))

def train_model(data_path=None, output_dir=None):
    if data_path is None:
        data_path = os.path.join(_PROJECT_ROOT, "data", "dataset.csv")
    if output_dir is None:
        output_dir = os.path.join(_PROJECT_ROOT, "models", "judgment_predictor")
    
    if not os.path.exists(data_path):
        logger.error(f"Dataset not found: {data_path}")
        return

    logger.info("Loading dataset...")
    df = pd.read_csv(data_path)
    
    texts = df['text'].tolist()
    labels = df['label'].tolist()
    
    # Split
    train_texts, val_texts, train_labels, val_labels = train_test_split(texts, labels, test_size=0.2, random_state=42)
    
    model_name = "nlpaueb/legal-bert-base-uncased"
    logger.info(f"Initializing model: {model_name}")
    
    tokenizer = AutoTokenizer.from_pretrained(model_name)
    model = AutoModelForSequenceClassification.from_pretrained(model_name, num_labels=2)
    
    # Tokenize
    # Truncate to 512 tokens (BERT limit)
    logger.info("Tokenizing data...")
    train_encodings = tokenizer(train_texts, truncation=True, padding=True, max_length=512)
    val_encodings = tokenizer(val_texts, truncation=True, padding=True, max_length=512)
    
    train_dataset = LegalDataset(train_encodings, train_labels)
    val_dataset = LegalDataset(val_encodings, val_labels)
    
    # Training Config
    training_args = TrainingArguments(
        output_dir='./results',
        num_train_epochs=3,
        per_device_train_batch_size=4, # Small batch for CPU/limited GPU
        per_device_eval_batch_size=8,
        warmup_steps=10,
        weight_decay=0.01,
        logging_dir='./logs',
        logging_steps=10,
        eval_strategy="epoch",
        save_strategy="epoch",
        load_best_model_at_end=True,
        no_cuda=False # Use CUDA if available
    )
    
    trainer = Trainer(
        model=model,
        args=training_args,
        train_dataset=train_dataset,
        eval_dataset=val_dataset,
        data_collator=DataCollatorWithPadding(tokenizer=tokenizer),
    )
    
    logger.info("Starting training...")
    trainer.train()
    
    logger.info(f"Saving model to {output_dir}...")
    model.save_pretrained(output_dir)
    tokenizer.save_pretrained(output_dir)
    logger.info("Training complete.")

if __name__ == "__main__":
    train_model()
