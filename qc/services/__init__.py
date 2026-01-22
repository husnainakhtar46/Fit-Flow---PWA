# QC Services Module
# Contains business logic separated from views

from .pdf_generator import generate_pdf_buffer, generate_final_inspection_pdf

__all__ = ['generate_pdf_buffer', 'generate_final_inspection_pdf']
