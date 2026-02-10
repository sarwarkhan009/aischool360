# Clean up AdmitCards.tsx file
with open('src/pages/exams/AdmitCards.tsx', 'r', encoding='utf-8') as f:
    lines = f.readlines()

# Keep only first 769 lines (0-768 in 0-indexed)
clean_lines = lines[:769]

# Write back
with open('src/pages/exams/AdmitCards.tsx', 'w', encoding='utf-8') as f:
    f.writelines(clean_lines)

print(f"File cleaned. Kept {len(clean_lines)} lines.")
