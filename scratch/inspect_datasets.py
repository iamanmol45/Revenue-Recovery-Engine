import pandas as pd

raw_path = "d:/Solo Hackathons/RazorPay/data/raw/transactions.csv"
scored_path = "d:/Solo Hackathons/RazorPay/data/processed/recovery_scored_transactions.csv"

raw_df = pd.read_csv(raw_path, nrows=5)
scored_df = pd.read_csv(scored_path, nrows=5)

print("=== RAW SCHEMA ===")
print(raw_df.dtypes)
print("\n=== SCORED SCHEMA ===")
print(scored_df.dtypes)

print("\n=== RAW DATA SAMPLE ===")
print(raw_df.head(2).to_dict(orient="records"))
print("\n=== SCORED DATA SAMPLE ===")
print(scored_df.head(2).to_dict(orient="records"))

# Let's read more to do some matching
print("\n=== ATTEMPTING TO MATCH ===")
# read raw with subset of columns to save memory
raw_cols = ['created_at', 'customer_id', 'booking_id', 'payment_status', 'total_amount']
raw_chunks = pd.read_csv(raw_path, usecols=raw_cols)

scored_cols = ['created_at', 'total_amount', 'failure_probability', 'recovery_priority']
scored_chunks = pd.read_csv(scored_path, usecols=scored_cols)

print(f"Loaded Raw rows: {len(raw_chunks)}")
print(f"Loaded Scored rows: {len(scored_chunks)}")

# Since timestamps might be slightly off or exactly same, let's try an exact merge
# first parse dates if necessary, or just treat as strings
merged = pd.merge(
    scored_chunks, 
    raw_chunks, 
    on=['created_at', 'total_amount'], 
    how='inner'
)

print(f"Exact matches on created_at + total_amount: {len(merged)}")
print(f"Unique matched scored records: {merged.duplicated(subset=scored_cols).sum()} duplicates")
print(f"Unmatched scored records: {len(scored_chunks) - len(merged.drop_duplicates(subset=scored_cols))}")

# Check matching by just timestamp (converting both to UTC string without timezone if needed)
# The raw has '2018-07-29T15:22:01.458193Z'
# The scored has '2022-03-23 21:28:38.595801+00:00'
# Let's convert to pandas datetime, then try to match
try:
    raw_chunks['dt'] = pd.to_datetime(raw_chunks['created_at'])
    scored_chunks['dt'] = pd.to_datetime(scored_chunks['created_at'])
    merged_dt = pd.merge(
        scored_chunks, 
        raw_chunks, 
        on=['dt', 'total_amount'], 
        how='inner'
    )
    print(f"\nExact matches on dt + total_amount: {len(merged_dt)}")
except Exception as e:
    print(f"Date conversion error: {e}")

