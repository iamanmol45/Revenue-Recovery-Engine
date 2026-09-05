import pandas as pd

csv_path = "d:/Solo Hackathons/RazorPay/data/processed/recovery_scored_transactions.csv"

# Read just a few rows to inspect columns and types
df_sample = pd.read_csv(csv_path, nrows=5)
print("--- PROCESSED CSV Sample ---")
print(df_sample.to_dict(orient="records"))

total_rows = sum(1 for _ in open(csv_path, 'r', encoding='utf-8')) - 1
print(f"\nTotal Rows in Processed CSV: {total_rows}")
