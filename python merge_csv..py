import pandas as pd

# Load your CSV files
df1 = pd.read_csv("azure_usage.csv")  # replace with your first CSV file name
df2 = pd.read_csv("external_factors.csv")  # replace with your second CSV file name

# Merge the CSV files
merged_df = pd.concat([df1, df2], ignore_index=True)

# Save the merged file
merged_df.to_csv("cleaned_merged.csv", index=False)

print("CSV files merged successfully!")
