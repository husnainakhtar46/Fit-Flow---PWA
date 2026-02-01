"""
POM Extractor Service

Extracts Points of Measure (POM) data from PDF and Excel files
using fuzzy column matching with RapidFuzz.
"""

import io
from typing import List, Dict, Optional, Tuple
from dataclasses import dataclass

import pdfplumber
import openpyxl
from rapidfuzz import fuzz, process


@dataclass
class ExtractedPOM:
    """Represents an extracted POM from a file"""
    name: str
    default_tol: float
    default_std: Optional[float] = None


@dataclass
class ExtractionResult:
    """Result of a file extraction operation"""
    success: bool
    poms: List[ExtractedPOM]
    matched_columns: Dict[str, str]
    confidence_scores: Dict[str, int]
    error: Optional[str] = None


# Column name variations for fuzzy matching
COLUMN_PATTERNS = {
    'name': [
        'description', 'desc', 'pom', 'pom name', 'point of measure',
        'measurement', 'measurement point', 'item', 'details', 'name',
        'specification', 'spec name', 'measure point', 'how to measure'
    ],
    'default_tol': [
        'tolerance', 'tol', '+/-', 'plus minus', 'plus/minus', 'tol (+/-)',
        'tolerance (+/-)', '+/- tol', 'allowance', 'variation', 'dev',
        'deviation', 'acceptable deviation', 'tol (-)', 'tol (+)', 'tol-', 'tol+'
    ],
    'default_std': [
        'standard', 'std', 'spec', 'specification', 'target', 'nominal',
        'base measurement', 'base', 'ideal', 'expected'
    ]
}

# Minimum fuzzy match confidence threshold (0-100)
MATCH_THRESHOLD = 70


class POMExtractor:
    """Extracts POM data from PDF and Excel files"""
    
    def extract(self, file_content: bytes, filename: str) -> ExtractionResult:
        """
        Extract POMs from a file based on its extension.
        
        Args:
            file_content: Raw bytes of the file
            filename: Original filename to determine file type
            
        Returns:
            ExtractionResult with extracted POMs and metadata
        """
        filename_lower = filename.lower()
        
        if filename_lower.endswith('.pdf'):
            return self.extract_from_pdf(file_content)
        elif filename_lower.endswith(('.xlsx', '.xls')):
            return self.extract_from_excel(file_content)
        else:
            return ExtractionResult(
                success=False,
                poms=[],
                matched_columns={},
                confidence_scores={},
                error=f"Unsupported file type: {filename}. Supported: PDF, XLSX, XLS"
            )
    
    def extract_from_pdf(self, file_content: bytes) -> ExtractionResult:
        """Extract POMs from a PDF file by finding tables"""
        try:
            print(f"[Extractor] Starting PDF extraction, file size: {len(file_content)} bytes")
            pdf_file = io.BytesIO(file_content)
            
            with pdfplumber.open(pdf_file) as pdf:
                all_tables = []
                print(f"[Extractor] PDF has {len(pdf.pages)} pages")
                
                # Extract tables from all pages
                for page_idx, page in enumerate(pdf.pages):
                    print(f"[Extractor] Processing page {page_idx + 1}")
                    tables = page.extract_tables()
                    print(f"[Extractor] Page {page_idx + 1} has {len(tables) if tables else 0} tables")
                    for table in tables:
                        if table and len(table) > 1:  # At least header + 1 row
                            print(f"[Extractor] Found table with {len(table)} rows")
                            # Print first row (headers) for debugging
                            if table[0]:
                                print(f"[Extractor] Table headers: {table[0][:5]}...")  # First 5 columns
                            all_tables.append(table)
                
                if not all_tables:
                    print("[Extractor] No tables found in PDF")
                    return ExtractionResult(
                        success=False,
                        poms=[],
                        matched_columns={},
                        confidence_scores={},
                        error="No tables found in PDF. Please ensure the PDF contains a measurement table."
                    )
                
                print(f"[Extractor] Total tables found: {len(all_tables)}")
                
                # Find the best table (one with matching columns)
                for table in all_tables:
                    result = self._process_table(table)
                    if result.success:
                        print(f"[Extractor] Successfully extracted {len(result.poms)} POMs")
                        return result
                
                # If no table matched, try the largest one
                largest_table = max(all_tables, key=lambda t: len(t))
                print(f"[Extractor] No direct match, trying largest table ({len(largest_table)} rows)")
                return self._process_table(largest_table)
                
        except Exception as e:
            import traceback
            error_trace = traceback.format_exc()
            print(f"[Extractor] Exception during PDF extraction:\n{error_trace}")
            return ExtractionResult(
                success=False,
                poms=[],
                matched_columns={},
                confidence_scores={},
                error=f"Error reading PDF: {str(e)}"
            )
    
    def extract_from_excel(self, file_content: bytes) -> ExtractionResult:
        """Extract POMs from an Excel file"""
        try:
            excel_file = io.BytesIO(file_content)
            workbook = openpyxl.load_workbook(excel_file, read_only=True, data_only=True)
            
            # Try each sheet
            for sheet_name in workbook.sheetnames:
                sheet = workbook[sheet_name]
                
                # Convert sheet to table format (list of lists)
                table = []
                for row in sheet.iter_rows(values_only=True):
                    # Skip completely empty rows
                    if any(cell is not None for cell in row):
                        table.append([str(cell) if cell is not None else '' for cell in row])
                
                if len(table) > 1:
                    result = self._process_table(table)
                    if result.success and result.poms:
                        return result
            
            return ExtractionResult(
                success=False,
                poms=[],
                matched_columns={},
                confidence_scores={},
                error="No measurement data found in Excel file. Please ensure it contains a table with POM and Tolerance columns."
            )
            
        except Exception as e:
            return ExtractionResult(
                success=False,
                poms=[],
                matched_columns={},
                confidence_scores={},
                error=f"Error reading Excel file: {str(e)}"
            )
    
    def _process_table(self, table: List[List[str]]) -> ExtractionResult:
        """
        Process a table to extract POM data.
        First row is assumed to be headers.
        """
        if not table or len(table) < 2:
            return ExtractionResult(
                success=False,
                poms=[],
                matched_columns={},
                confidence_scores={},
                error="Table too small (needs header + at least 1 data row)"
            )
        
        # Find header row - scan first few rows to find one with Description/POM column
        header_row = None
        data_start_idx = 0
        
        # Try to find a row that contains a column matching our 'name' patterns
        for idx, row in enumerate(table[:min(5, len(table))]):  # Check first 5 rows
            if not any(cell and str(cell).strip() for cell in row):
                continue
            
            potential_header = [str(cell).strip() if cell else '' for cell in row]
            print(f"[Extractor] Checking row {idx} as potential header: {potential_header[:6]}...")
            
            # Try to match columns
            test_mapping, test_scores = self._match_columns(potential_header)
            
            # If we found a 'name' column, use this row as header
            if 'name' in test_mapping:
                header_row = potential_header
                data_start_idx = idx + 1
                print(f"[Extractor] Found header row at index {idx}, matched 'name' to column {test_mapping['name']}")
                break
        
        # Fallback to first non-empty row if no match found
        if not header_row:
            for idx, row in enumerate(table):
                if any(cell and str(cell).strip() for cell in row):
                    header_row = [str(cell).strip() if cell else '' for cell in row]
                    data_start_idx = idx + 1
                    print(f"[Extractor] Using fallback: first non-empty row at index {idx}")
                    break
        
        if not header_row:
            return ExtractionResult(
                success=False,
                poms=[],
                matched_columns={},
                confidence_scores={},
                error="Could not find header row in table"
            )
        
        # Match columns using fuzzy matching
        column_mapping, confidence_scores = self._match_columns(header_row)
        print(f"[Extractor] Column mapping result: {column_mapping}")
        print(f"[Extractor] Confidence scores: {confidence_scores}")
        
        # We need at least the name column
        if 'name' not in column_mapping:
            # Show all non-empty columns for debugging
            non_empty_cols = [col for col in header_row if col]
            return ExtractionResult(
                success=False,
                poms=[],
                matched_columns={},
                confidence_scores={},
                error=f"Could not find a Description/POM name column. Available columns: {', '.join(non_empty_cols)}"
            )
        
        matched_columns = {
            field: header_row[col_idx] 
            for field, col_idx in column_mapping.items()
        }
        
        # Extract data rows
        poms = []
        for row in table[data_start_idx:]:
            if not row or not any(str(cell).strip() if cell else '' for cell in row):
                continue  # Skip empty rows
            
            # Pad row if needed
            while len(row) < len(header_row):
                row.append('')
            
            name_idx = column_mapping['name']
            name = str(row[name_idx]).strip() if name_idx < len(row) and row[name_idx] else ''
            
            if not name:
                continue  # Skip rows without a name
            
            # Extract tolerance (always use absolute value)
            default_tol = 0.0
            if 'default_tol' in column_mapping:
                tol_idx = column_mapping['default_tol']
                if tol_idx < len(row) and row[tol_idx]:
                    default_tol = abs(self._parse_number(str(row[tol_idx])))
            
            # Extract standard (optional)
            default_std = None
            if 'default_std' in column_mapping:
                std_idx = column_mapping['default_std']
                if std_idx < len(row) and row[std_idx]:
                    std_value = self._parse_number(str(row[std_idx]))
                    if std_value != 0.0:
                        default_std = std_value
            
            poms.append(ExtractedPOM(
                name=name,
                default_tol=default_tol,
                default_std=default_std
            ))
        
        if not poms:
            return ExtractionResult(
                success=False,
                poms=[],
                matched_columns=matched_columns,
                confidence_scores=confidence_scores,
                error="No valid POM data found in table rows"
            )
        
        return ExtractionResult(
            success=True,
            poms=poms,
            matched_columns=matched_columns,
            confidence_scores=confidence_scores
        )
    
    def _match_columns(self, headers: List[str]) -> Tuple[Dict[str, int], Dict[str, int]]:
        """
        Match header columns to expected fields using fuzzy matching.
        
        Returns:
            Tuple of (column_mapping, confidence_scores)
            - column_mapping: dict mapping field name to column index
            - confidence_scores: dict mapping field name to match confidence (0-100)
        """
        column_mapping = {}
        confidence_scores = {}
        
        for field, patterns in COLUMN_PATTERNS.items():
            best_match_idx = None
            best_score = 0
            best_pattern = None
            
            for idx, header in enumerate(headers):
                if not header:
                    continue
                
                header_lower = header.lower().strip()
                
                # Try exact match first
                if header_lower in patterns:
                    best_match_idx = idx
                    best_score = 100
                    best_pattern = header_lower
                    break
                
                # Fuzzy match against all patterns
                for pattern in patterns:
                    score = fuzz.ratio(header_lower, pattern)
                    
                    # Also try partial ratio for longer strings
                    partial_score = fuzz.partial_ratio(header_lower, pattern)
                    score = max(score, partial_score)
                    
                    if score > best_score and score >= MATCH_THRESHOLD:
                        best_score = score
                        best_match_idx = idx
                        best_pattern = pattern
            
            if best_match_idx is not None and best_score >= MATCH_THRESHOLD:
                # Avoid duplicate column assignments
                if best_match_idx not in column_mapping.values():
                    column_mapping[field] = best_match_idx
                    confidence_scores[field] = best_score
        
        return column_mapping, confidence_scores
    
    def _parse_number(self, value: str) -> float:
        """Parse a string to a float, handling various formats"""
        if not value:
            return 0.0
        
        # Remove common non-numeric characters
        cleaned = value.strip()
        cleaned = cleaned.replace(',', '.')  # Handle European decimal format
        
        # Remove +/- prefix if present
        if cleaned.startswith('+/-') or cleaned.startswith('±'):
            cleaned = cleaned[3:] if cleaned.startswith('+/-') else cleaned[1:]
        elif cleaned.startswith('+') or cleaned.startswith('-'):
            pass  # Keep the sign
        
        # Extract just the numeric part
        import re
        match = re.search(r'[-+]?\d*\.?\d+', cleaned)
        
        if match:
            try:
                return float(match.group())
            except ValueError:
                return 0.0
        
        return 0.0


# Convenience function for direct use
def extract_pom_from_file(file_content: bytes, filename: str) -> ExtractionResult:
    """
    Extract POMs from a file.
    
    Args:
        file_content: Raw bytes of the file
        filename: Original filename to determine file type
        
    Returns:
        ExtractionResult with extracted POMs and metadata
    """
    extractor = POMExtractor()
    return extractor.extract(file_content, filename)
