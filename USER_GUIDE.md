# Fit Flow - Quality Check Management System
## User Guide

Welcome to **Fit Flow**, a comprehensive Quality Check Management System designed for garment inspection and quality assurance. This guide will help you navigate the system based on your role.

---

## Table of Contents

1. [Getting Started](#getting-started)
2. [User Roles](#user-roles)
3. [Login Process](#login-process)
4. [Admin User Guide](#admin-user-guide)
5. [QA User Guide](#qa-user-guide)
6. [Common Workflows](#common-workflows)
7. [Tips & Best Practices](#tips--best-practices)

---

## Getting Started

### System Requirements
- Modern web browser (Chrome, Firefox, Safari, or Edge)
- Stable internet connection
- Login credentials provided by your administrator

### Accessing the System
Navigate to your Fit Flow URL and use your provided credentials to log in.

---

## User Roles

Fit Flow has two distinct user roles with different access levels:

### 👤 **Admin (Superuser)**
- Full access to all features
- Can manage customers and view dashboard
- Access to: Dashboard, Sample Evaluation, Templates, Customers

### 👤 **QA (Quality Assurance)**
- Limited access focused on inspection tasks
- Cannot access customer management or dashboard
- Access to: Sample Evaluation, Templates

> **Note:** Your role is assigned by the system administrator and determines which menu items you can see.

---

## Login Process

1. Navigate to the Fit Flow login page
2. Enter your **username**
3. Enter your **password**
4. Click the **"Login"** button

After successful login, you'll be redirected to your default page based on your role:
- **Admin:** Dashboard
- **QA:** Sample Evaluation

> **Tip:** If you encounter login issues, verify your credentials with your system administrator.

---

## Admin User Guide

As an Admin, you have access to all features of the system.

### 📊 Dashboard

The Dashboard provides a comprehensive overview of your quality inspection operations.

**Features:**
- **Total Inspections:** Overall count of all evaluations
- **Pass/Fail Statistics:** Visual breakdown of inspection results
- **Pass Rate Percentage:** Overall quality metrics
- **Recent Inspections:** Quick view of the latest 5 evaluations

**How to Use:**
1. Click **"Dashboard"** in the sidebar
2. Review key metrics at the top
3. Check recent inspections in the table below
4. Use this data to monitor quality trends

---

### 👥 Customers

Manage your customer database and email contacts.

#### Adding a New Customer

1. Click **"Customers"** in the sidebar
2. Click the **"+ Add Customer"** button
3. Fill in the customer details:
   - **Name:** Customer company name *(required)*
   - **Contact Person:** Primary contact *(optional)*
   - **Phone:** Contact number *(optional)*
4. Click **"Create Customer"**

#### Managing Customer Emails

Each customer can have multiple email addresses for report distribution.

**Adding Emails:**
1. Find the customer in the list
2. Click **"Manage Emails"**
3. Enter the email address
4. Select email type:
   - **To:** Primary recipient (will receive the email directly)
   - **CC:** Carbon copy (will be copied on the email)
5. Click **"Add Email"**

**Deleting Emails:**
1. In the Manage Emails dialog
2. Click the **"Delete"** button next to the email you want to remove

> **Important:** You must have at least one "To" email address to send reports via email.

#### Editing Customers

1. Find the customer in the list
2. Click the **"Edit"** button
3. Update the required fields
4. Click **"Update Customer"**

#### Deleting Customers

1. Find the customer in the list
2. Click the **"Delete"** button
3. Confirm the deletion

> **Warning:** Deleting a customer will remove all associated data. This action cannot be undone.

---

### 📋 Templates

Templates define the measurement points (POM - Point of Measure) for different garment styles.

#### Creating a New Template

1. Click **"Templates"** in the sidebar
2. Click **"+ Add Template"**
3. Fill in template details:
   - **Name:** Template identifier *(required)*
   - **Customer:** Associated customer *(required)*
4. Click **"Create Template"**

#### Adding Measurement Points

After creating a template, add the specific measurement points:

1. Find your template and click **"Add POM"**
2. Enter POM details:
   - **POM Name:** Measurement point (e.g., "Chest Width", "Sleeve Length")
   - **Tolerance:** Acceptable deviation (e.g., 0.5)
   - **Standard:** Target measurement value (e.g., 45.0)
3. Click **"Add POM"**
4. Repeat for all measurement points

**Example POMs:**
- Shoulder Width: Tol 0.3, Std 42.0
- Chest Width: Tol 0.5, Std 50.0
- Sleeve Length: Tol 0.3, Std 60.0
- Garment Length: Tol 0.5, Std 72.0

#### Managing Templates

**Filter by Customer:**
- Use the dropdown to view templates for a specific customer

**Edit Template:**
1. Click the **"Edit"** button next to the template
2. Update details and click **"Update Template"**

**Delete Template:**
- Click the **"Delete"** button and confirm

---

### 📝 Sample Evaluation (Inspections)

This is the core feature for creating and managing quality inspection reports.

#### Creating a New Inspection

1. Click **"Sample Evaluation"** in the sidebar
2. Click **"+ New Evaluation"**
3. Fill in the inspection details:

**Basic Information:**
- **Style:** Style number/code *(required)*
- **Color:** Garment color *(optional)*
- **PO Number:** Purchase order number *(required)*
- **Stage:** Inspection stage (SMS, Size Set, TOP, Shipment, etc.)
- **Decision:** Inspection result (Accepted, Rejected, Represent)
- **Customer:** Select from dropdown *(required)*
- **Template:** Select measurement template *(required)*

**Measurements Section:**
- Six sample columns (S1-S6) will be displayed
- Enter measurements for each sample
- Values exceeding tolerance will be highlighted in **red**

**Quality Assessment Comments:**
- **Customer Remarks:** Customer feedback/concerns
- **QA Fit Comments:** Fit evaluation notes
- **QA Workmanship Comments:** Construction quality notes
- **QA Wash Comments:** Wash/color assessment
- **QA Fabric Comments:** Fabric quality notes
- **QA Accessories Comments:** Trims and accessories notes
- **Final Remarks:** Overall summary

4. Click **"Create Inspection"**

#### Uploading Images

1. Open an existing inspection (click on any inspection in the list)
2. Scroll to the **Images** section
3. Click **"Choose File"** or drag and drop an image
4. Add a caption (optional but recommended)
5. Click **"Upload"**

> **Note:** Images are automatically compressed to WebP format at 1600×1600 max resolution to save storage space while maintaining quality.

**Deleting Images:**
- Click the **"Delete"** button below the image

#### Generating PDF Reports

1. View an inspection
2. Click the **"Download PDF"** button
3. The PDF will include:
   - Inspection details and decision status
   - Complete measurements table (with out-of-tolerance values in red)
   - All quality comments
   - Up to 4 images with captions

#### Emailing Reports

1. View an inspection
2. Ensure the customer has at least one **"To"** email address
3. Click the **"Send Email"** button
4. The system will:
   - Generate a PDF report
   - Send to all "To" recipients
   - CC all "CC" recipients
   - Include subject with PO, Style, Color, Date, and Decision

**Email Subject Format:**
```
[Customer Name] - PO: [PO Number] - Style: [Style] - Color: [Color] - [Date] - Decision: [Decision]
```

#### Searching Inspections

Use the search bar to find inspections by:
- Style number
- PO number
- Customer name
- Created by (username)

#### Copying Inspections

To create a new inspection based on an existing one:
1. Click on an inspection to view it
2. Click the **"Copy"** button
3. Modify the details as needed
4. Click **"Create Inspection"**

---

## QA User Guide

As a QA user, you focus on creating and managing inspections.

### Your Available Features

- ✅ Sample Evaluation (Inspections)
- ✅ Templates (View only)
- ❌ Dashboard (Admin only)
- ❌ Customers (Admin only)

### Creating Inspections

Follow the same process as described in the [Admin Guide - Sample Evaluation](#-sample-evaluation-inspections) section.

### Uploading Images

You can upload inspection images following the steps in [Uploading Images](#uploading-images).

### Generating Reports

You can generate PDF reports and send emails using the **Download PDF** and **Send Email** buttons.

### Using Templates

You can view available templates to know which measurement points to capture, but you cannot create or edit templates (Admin function).

---

## Common Workflows

### Workflow 1: Setting Up a New Customer (Admin Only)

1. **Add Customer**
   - Navigate to Customers
   - Click "+ Add Customer"
   - Enter customer details

2. **Add Email Addresses**
   - Click "Manage Emails" for the customer
   - Add at least one "To" email
   - Add any "CC" emails

3. **Create Templates**
   - Navigate to Templates
   - Click "+ Add Template"
   - Select the customer
   - Add all measurement points (POMs)

### Workflow 2: Conducting a Sample Evaluation

1. **Create Inspection**
   - Navigate to Sample Evaluation
   - Click "+ New Evaluation"
   - Select Customer and Template
   - Fill in Style, PO Number, Stage

2. **Enter Measurements**
   - Measure all 6 samples for each POM
   - Watch for red highlighting (out of tolerance)
   - Record measurements accurately

3. **Add Quality Comments**
   - Fill in all relevant quality assessment sections
   - Be specific and detailed
   - Note any defects or concerns

4. **Upload Images**
   - Upload photos of the samples
   - Add descriptive captions
   - Include images of any defects

5. **Make Decision**
   - Select: Accepted, Rejected, or Represent
   - Base decision on measurements and quality assessment

6. **Send Report**
   - Click "Send Email" to distribute to customer
   - Or "Download PDF" to save locally

### Workflow 3: Reusing Previous Inspections

1. **Find Similar Inspection**
   - Use search to find previous inspection of same style

2. **Copy Inspection**
   - Open the inspection
   - Click "Copy" button
   - Template and measurements are pre-filled

3. **Update Details**
   - Change PO Number, Color, Stage as needed
   - Update measurements for new samples
   - Update comments and decision

4. **Save and Send**
   - Create the new inspection
   - Upload new images
   - Send report

---

## Tips & Best Practices

### For All Users

✅ **Accurate Measurements**
- Double-check all measurements before saving
- Use calibrated measuring tools
- Measure samples consistently

✅ **Clear Comments**
- Be specific in quality comments
- Include actionable feedback
- Note both positives and negatives

✅ **Proper Images**
- Upload clear, well-lit photos
- Use descriptive captions
- Include overall shots and detail shots
- Capture any defects clearly

✅ **Consistent Naming**
- Use standard style codes
- Include color names consistently
- Use proper PO numbers

### For Admins

✅ **Customer Setup**
- Verify email addresses are correct
- Separate "To" and "CC" properly
- Keep customer information up to date

✅ **Template Management**
- Create templates for each garment type
- Use consistent POM naming
- Set realistic tolerances
- Review and update templates regularly

✅ **User Management**
- Assign appropriate roles
- Train QA users on proper procedures
- Review inspection quality periodically

### For QA Users

✅ **Before Starting**
- Verify you have the correct template
- Ensure all samples are properly labeled
- Have measurement tools ready

✅ **During Inspection**
- Measure in the same order each time
- Note any issues immediately
- Take photos during inspection, not after

✅ **Before Submitting**
- Review all measurements
- Check for red (out-of-tolerance) values
- Ensure decision matches assessment
- Verify images are uploaded

---

## Troubleshooting

### Cannot Login
- Verify username and password
- Check with administrator for account status
- Ensure Caps Lock is off

### Cannot See Dashboard or Customers
- This is normal for QA users
- Only Admins can access these features
- Contact administrator if you need admin access

### Email Not Sending
- Verify customer has at least one "To" email address
- Check that email addresses are correct
- Contact administrator if problem persists

### Images Not Uploading
- Check file size (large files may take longer)
- Ensure file is an image format (JPG, PNG, WebP)
- Verify internet connection
- Try a different browser if issue persists

### Measurements Showing Red
- Red indicates the value exceeds tolerance
- Verify the measurement is correct
- This helps identify quality issues
- Document the reason in comments

---

## Support

For technical support or questions:
- **Contact your system administrator**
- **Report bugs** with detailed steps to reproduce
- **Suggest improvements** based on your workflow needs

---

## Appendix: Terminology

| Term | Definition |
|------|------------|
| **POM** | Point of Measure - Specific measurement location on garment |
| **Tolerance** | Acceptable deviation from standard measurement |
| **Standard** | Target/ideal measurement value |
| **Stage** | Inspection phase (SMS, Size Set, TOP, Shipment, etc.) |
| **Decision** | Final inspection result (Accepted, Rejected, Represent) |
| **Template** | Set of measurement points for a garment type |
| **Sample** | Individual garment being measured (S1-S6) |
| **TOP** | Top of Production inspection |
| **SMS** | Sample evaluation stage |

---

**Version:** 1.0  
**Last Updated:** November 2025

---

*Thank you for using Fit Flow Quality Check Management System!*
