import pandas as pd
import numpy as np
import sys

raw_path = "d:/Solo Hackathons/RazorPay/data/raw/transactions.csv"
scored_path = "d:/Solo Hackathons/RazorPay/data/processed/recovery_scored_transactions.csv"

def analyze_csv(path, name):
    print(f"\n==================================================")
    print(f"FORENSIC REPORT: {name}")
    print(f"==================================================")
    
    # Read entire file for accurate counts
    df = pd.read_csv(path)
    
    print(f"EXACT ROW COUNT: {len(df)}")
    print(f"EXACT COLUMN NAMES:\n{df.columns.tolist()}\n")
    print(f"DATA TYPES:\n{df.dtypes}\n")
    
    print("FIRST 5 ROWS:")
    print(df.head(5).to_dict(orient="records"))
    print("\nLAST 5 ROWS:")
    print(df.tail(5).to_dict(orient="records"))
    
    print("\nNULL COUNTS:")
    print(df.isnull().sum())
    
    print("\nUNIQUE COUNTS FOR IDENTIFIER/CATEGORICAL COLUMNS:")
    for col in df.columns:
        if df[col].dtype == 'object' or 'id' in col.lower() or 'status' in col.lower() or df[col].nunique() < 100:
            print(f"  {col}: {df[col].nunique()} unique values")
            if df[col].nunique() < 10:
                print(f"    Values: {df[col].unique().tolist()}")
                
    print("\nMIN/MAX FOR NUMERIC COLUMNS:")
    for col in df.select_dtypes(include=[np.number]).columns:
        if 'id' not in col.lower() and 'lat' not in col.lower() and 'long' not in col.lower():
            print(f"  {col}: Min={df[col].min()}, Max={df[col].max()}")
            
    print("\nDUPLICATE COUNTS:")
    for col in df.columns:
        if 'id' in col.lower() or col == 'created_at':
            dupes = df.duplicated(subset=[col]).sum()
            print(f"  {col}: {dupes} duplicate rows")

    return df

print("Starting analysis... This may take a moment for large files.")
raw_df = analyze_csv(raw_path, "RAW DATASET (transactions.csv)")
scored_df = analyze_csv(scored_path, "SCORED DATASET (recovery_scored_transactions.csv)")

print("\n==================================================")
print("JOIN ANALYSIS")
print("==================================================")

# Convert to UTC datetime to normalize
raw_df['dt'] = pd.to_datetime(raw_df['created_at'], utc=True)
scored_df['dt'] = pd.to_datetime(scored_df['created_at'], utc=True)

merged_df = pd.merge(scored_df, raw_df, on=['dt', 'total_amount'], how='inner')

print(f"Join Strategy: Inner join on 'created_at' (parsed to datetime) AND 'total_amount'")
print(f"Expected Match Count (Scored records): {len(scored_df)}")
print(f"Actual Match Count: {len(merged_df)}")

# Check unmatched
unmatched_scored = len(scored_df) - len(merged_df.drop_duplicates(subset=scored_df.columns.tolist()[:-1]))
print(f"Unmatched processed rows: {unmatched_scored}")

# Check duplicates
dupe_matches = merged_df.duplicated(subset=['booking_id']).sum()
print(f"Duplicate matches based on raw booking_id: {dupe_matches}")

print("\nSAMPLE MATCHED RECORD (first 1):")
if len(merged_df) > 0:
    sample = merged_df.head(1).to_dict(orient="records")[0]
    # Filter to print a subset of important columns to avoid console flood
    keys = ['dt', 'booking_id', 'customer_id', 'total_amount', 'payment_status', 'failure_probability', 'recovery_priority']
    print({k: sample.get(k) for k in keys if k in sample})

