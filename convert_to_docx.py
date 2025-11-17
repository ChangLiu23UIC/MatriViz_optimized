#!/usr/bin/env python3
"""
Script to help convert Markdown user manual to DOCX format

This script provides instructions for converting the USER_MANUAL.md file to DOCX format
using common tools like Pandoc or online converters.
"""

import os
import sys

def main():
    print("MatriViz User Manual - DOCX Conversion Helper")
    print("=" * 50)

    # Check if markdown file exists
    md_file = "USER_MANUAL.md"
    docx_file = "USER_MANUAL.docx"

    if not os.path.exists(md_file):
        print(f"❌ Error: {md_file} not found in current directory")
        print(f"Current directory: {os.getcwd()}")
        return 1

    print(f"✅ Found {md_file}")
    print()

    # Method 1: Using Pandoc (recommended)
    print("Method 1: Using Pandoc (Recommended)")
    print("-" * 40)
    print("1. Install Pandoc: https://pandoc.org/installing.html")
    print("2. Run this command:")
    print(f'   pandoc "{md_file}" -o "{docx_file}"')
    print()

    # Method 2: Using online converters
    print("Method 2: Online Converters")
    print("-" * 40)
    print("1. Copy the content from USER_MANUAL.md")
    print("2. Use one of these online tools:")
    print("   - https://cloudconvert.com/markdown-to-docx")
    print("   - https://www.markdowntodocx.com/")
    print("   - https://www.online-convert.com/")
    print()

    # Method 3: Using Word (if available)
    print("Method 3: Using Microsoft Word")
    print("-" * 40)
    print("1. Open Microsoft Word")
    print("2. Go to File → Open")
    print(f"3. Select '{md_file}'")
    print("4. Word will automatically convert it to DOCX format")
    print("5. Save as DOCX file")
    print()

    # Method 4: Using LibreOffice
    print("Method 4: Using LibreOffice")
    print("-" * 40)
    print("1. Open LibreOffice Writer")
    print(f"2. Open '{md_file}'")
    print("3. Go to File → Save As")
    print("4. Choose 'Microsoft Word 2007-365 (.docx)' format")
    print(f"5. Save as '{docx_file}'")
    print()

    print("Additional Tips:")
    print("- The DOCX version will maintain the structure and formatting")
    print("- Table of Contents links will work in the DOCX file")
    print("- Images and code blocks will be properly formatted")

    return 0

if __name__ == "__main__":
    sys.exit(main())