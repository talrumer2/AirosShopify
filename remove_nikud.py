#!/usr/bin/env python3
import re
import json
import sys


def remove_nikud(text):
    """
    Remove Hebrew nikud (diacritical marks) from text.
    This includes vowel points, cantillation marks, and other Hebrew diacritics.
    """
    # Hebrew nikud/diacritics Unicode ranges:
    # U+05B0-U+05C7 (Hebrew points)
    # U+05C8-U+05CF (additional Hebrew marks)
    # U+0591-U+05AF (Hebrew cantillation marks)
    nikud_pattern = r"[\u0591-\u05C7]"
    return re.sub(nikud_pattern, "", text)


def process_json_value(value):
    """Recursively process JSON values to remove nikud from strings."""
    if isinstance(value, str):
        return remove_nikud(value)
    elif isinstance(value, dict):
        return {k: process_json_value(v) for k, v in value.items()}
    elif isinstance(value, list):
        return [process_json_value(item) for item in value]
    else:
        return value


def main():
    # Allow specifying file as command line argument, default to he-IL.json
    if len(sys.argv) > 1:
        input_file = sys.argv[1]
    else:
        input_file = "locales/he-IL.json"

    print(f"Processing file: {input_file}")

    # Read the file content
    with open(input_file, "r", encoding="utf-8") as f:
        content = f.read()

    # Extract the comment header (before the JSON)
    lines = content.split("\n")
    json_start = 0
    for i, line in enumerate(lines):
        if line.strip() == "{":
            json_start = i
            break

    header_lines = lines[:json_start]
    json_content = "\n".join(lines[json_start:])

    # Parse JSON content
    try:
        data = json.loads(json_content)
    except json.JSONDecodeError as e:
        print(f"Error parsing JSON: {e}")
        return

    # Process the JSON to remove nikud
    cleaned_data = process_json_value(data)

    # Convert back to JSON with proper formatting
    cleaned_json = json.dumps(cleaned_data, ensure_ascii=False, indent=2)

    # Combine header and cleaned JSON
    result = "\n".join(header_lines) + "\n" + cleaned_json

    # Write the cleaned content back to file
    with open(input_file, "w", encoding="utf-8") as f:
        f.write(result)

    print(f"Nikud dots have been removed from the Hebrew text in {input_file}")


if __name__ == "__main__":
    main()
