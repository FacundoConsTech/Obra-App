# Obra App

Obra App is a construction management web application designed to help small and medium construction teams organize planned work, daily progress, crews, payroll calculations, and payment receipts.

The app was created as an experimental ConTech tool focused on improving how construction companies track work execution and payment information on site.

## Main Purpose

The goal of Obra App is to connect three key construction workflows:

1. Planned tasks  
2. Daily work entries  
3. Payroll and payment receipts  

Instead of managing this information separately in spreadsheets, notes, or informal messages, the app centralizes the workflow in one place.

## Features

### Projects

Users can create and manage different construction projects.  
Each project keeps its own tasks, crews, daily entries, payroll records, and receipts.

### Planned Tasks

The Planned section allows users to create and manage construction tasks, including:

- Work category / rubro
- Task code
- Description
- Total planned quantity
- Unit
- Unit price

Tasks can be archived when they already contain related information, such as daily entries or payroll data.

### Daily Entries

The Daily Entries section is used to record real work completed on site.

Each entry can include:

- Date
- Crew
- Task
- Completed quantity
- Unit
- Foreman
- Notes
- Optional photo reference

This section works as the operational record of what was actually executed in the project.

### Crews

The app allows users to create and manage construction crews, including:

- Crew name
- Foreman name
- Contact information
- Number of workers
- Notes

Crews are connected to daily entries and payroll calculations.

### Payroll

The Payroll section calculates how much each crew should be paid based on the executed work recorded in Daily Entries.

The app calculates:

- Executed quantity
- Unit price
- Total amount
- Pending amount
- Already liquidated amount

Once a payroll receipt is emitted, the paid amount is registered and should not appear again as pending.

### Receipts / Comprobantes

The app stores emitted payment receipts, allowing the user to review previously liquidated payroll records.

Receipts are linked to:

- Project
- Crew
- Payroll period
- Liquidated items
- Total amount
- Issue date

Receipt numbering is managed per project.

### Stats

The Stats section provides a summary of project activity, including operational and payroll-related indicators.

## Tech Stack

- React
- TypeScript
- Vite
- Tailwind CSS
- Supabase
- Vercel
- GitHub

## Database

The app uses Supabase as the backend database and authentication system.

Main database entities include:

- `projects`
- `crews`
- `tasks`
- `task_prices`
- `daily_entries`
- `payroll_periods`
- `payment_receipts`
- `payroll_liquidation_items`
- `receipt_number_counters_by_project`

## Deployment

The app is deployed with Vercel.

## Development Workflow

The project was developed using Cursor and AI-assisted coding tools, with GitHub Desktop used for version control.

## Project Status

This is an active prototype / MVP.

The current focus is to validate construction workflows such as:

- Task planning
- On-site progress tracking
- Crew-based payroll
- Receipt generation
- Avoiding duplicate payroll liquidation

## Why This App Exists

In many construction companies, field information is still fragmented across paper notes, WhatsApp messages, spreadsheets, and manual calculations.

Obra App explores how simple digital tools can improve construction operations by making site data easier to capture, calculate, and audit.

## Author

Created by Facundo Pérez as part of a broader exploration into Construction Technology, digital workflows, and software applied to the built environment.
