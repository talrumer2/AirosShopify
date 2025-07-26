#!/usr/bin/env python3
import re
import json
import sys


def fix_translations_and_gender(text):
    """
    Fix common Hebrew translation errors and convert masculine forms to feminine.
    """
    if not isinstance(text, str) or not text:
        return text

    # Common translation fixes
    translation_fixes = {
        # Basic terms
        "מגע": "פרטים ליצירת קשר",
        "אלקטרוני": 'דוא"ל',
        "להגיש": "שלח",
        "מובלט": "מוצג",
        "תאור": "תיאור",
        # More specific fixes
        "מידע על משלוח": "פרטי משלוח",
        "מידע": "פרטים",
        "אזור": "איזור",
        "מחוז": "מדינה",
        # Gender-specific fixes (masculine to feminine)
        "אתה בטוח": "את בטוחה",
        "אתה יכול": "את יכולה",
        "אתה אמור": "את אמורה",
        "אתה צריך": "את צריכה",
        "אתה רוצה": "את רוצה",
        "שלך": "שלך",  # This one stays the same in this context
        # Imperative forms (masculine to feminine)
        "בחר": "בחרי",
        "הזן": "הזיני",
        "הוסף": "הוסיפי",
        "עדכן": "עדכני",
        "צור": "צרי",
        "שמור": "שמרי",
        "מחק": "מחקי",
        "רענן": "רענני",
        "נסה": "נסי",
        "בדוק": "בדקי",
        "השתמש": "השתמשי",
        "המשך": "המשיכי",
        "חזור": "חזרי",
        "סגור": "סגרי",
        "פתח": "פתחי",
        "לחץ": "לחצי",
        "שנה": "שני",
        "השלם": "השלימי",
        "קבל": "קבלי",
        "בטל": "בטלי",
        # Participles and adjectives (masculine to feminine)
        "מחובר": "מחוברת",
        "נדרש": "נדרשת",
        "זמין": "זמינה",
        "מוכן": "מוכנה",
        "בטוח": "בטוחה",
        "מעוניין": "מעוניינת",
        "רוצה": "רוצה",  # Same for both genders
        # Verbs (past tense masculine to feminine)
        "ביצעת": "ביצעת",  # This one is actually the same for both genders in this context
        "קיבלת": "קיבלת",  # Same
        "שלחת": "שלחת",  # Same
        # Nouns that should be more accurate
        "עגלת קניות": "עגלת קניות",
        "כרטיס מתנה": "כרטיס מתנה",
        'דוא"ל אישור': "אימייל אישור",
        # Present tense fixes (masculine to feminine)
        "אינך מקבל": "אינך מקבלת",
        "אתה מקבל": "את מקבלת",
        "תקבל": "תקבלי",
        "תוכל": "תוכלי",
        "תרצה": "תרצי",
        "תהיה": "תהיי",
        "תשלם": "תשלמי",
        "תבחר": "תבחרי",
        "תעדכן": "תעדכני",
        "תוסיף": "תוסיפי",
        "תמחק": "תמחקי",
        "תשנה": "תשני",
        # Common phrases
        "אנא נסה": "אנא נסי",
        "אנא בדוק": "אנא בדקי",
        "אנא הזן": "אנא הזיני",
        "אנא בחר": "אנא בחרי",
        "אנא השתמש": "אנא השתמשי",
        "אנא עדכן": "אנא עדכני",
        "אנא המשך": "אנא המשיכי",
        # Button text fixes
        "המשך קניות": "המשיכי לקניות",
        "חזור לעגלה": "חזרי לעגלה",
        "חזור לחנות": "חזרי לחנות",
    }

    # Apply fixes
    result = text
    for masculine, feminine in translation_fixes.items():
        # Use word boundaries to avoid partial matches
        pattern = r"\b" + re.escape(masculine) + r"\b"
        result = re.sub(pattern, feminine, result)

    # Additional pattern-based fixes for more complex cases

    # Fix "תוכל/תוכלי" patterns
    result = re.sub(r"\bתוכל\b", "תוכלי", result)

    # Fix "צריך/צריכה" patterns
    result = re.sub(r"\bצריך\b", "צריכה", result)

    # Fix "אמור/אמורה" patterns
    result = re.sub(r"\bאמור\b", "אמורה", result)

    return result


def process_json_value(value):
    """Recursively process JSON values to fix translations and gender."""
    if isinstance(value, str):
        return fix_translations_and_gender(value)
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

    print(f"Fixing Hebrew translations and gender in: {input_file}")

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

    # Process the JSON to fix translations and gender
    fixed_data = process_json_value(data)

    # Convert back to JSON with proper formatting
    fixed_json = json.dumps(fixed_data, ensure_ascii=False, indent=2)

    # Combine header and fixed JSON
    result = "\n".join(header_lines) + "\n" + fixed_json

    # Write the fixed content back to file
    with open(input_file, "w", encoding="utf-8") as f:
        f.write(result)

    print(f"Hebrew translations and gender have been fixed in {input_file}")


if __name__ == "__main__":
    main()
