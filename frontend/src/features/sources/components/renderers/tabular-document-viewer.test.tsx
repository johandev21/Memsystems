import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import type { SourceWithContent } from "../../types";
import { TabularDocumentViewer } from "./tabular-document-viewer";

const mockCsvSource: SourceWithContent = {
  id: "src-csv",
  notebookId: "nb-1",
  kind: "file",
  modality: "dataset",
  title: "Employee Salaries.csv",
  url: null,
  contentType: "text/csv",
  fileSize: 1024,
  createdAt: "2026-08-30T12:00:00.000Z",
  rawText: [
    "# Employee Salaries",
    "## Sheet: Salaries",
    "| EmployeeId | Name | Department | Salary |",
    "|---|---|---|---|",
    "| 101 | Alice Smith | Engineering | 125000 |",
    "| 102 | Bob Jones | Marketing | 85000 |",
    "| 103 | Charlie Brown | Design | 95000 |",
  ].join("\n"),
  s3Key: "uploads/salaries.csv",
  sha256: "csvsha",
};

const mockMultiSheetSource: SourceWithContent = {
  id: "src-xlsx",
  notebookId: "nb-1",
  kind: "file",
  modality: "dataset",
  title: "Quarterly Financials.xlsx",
  url: null,
  contentType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  fileSize: 5000,
  createdAt: "2026-08-30T12:00:00.000Z",
  rawText: [
    "## Sheet: Revenue",
    "| Quarter | Amount |",
    "|---|---|",
    "| Q1 | 500000 |",
    "| Q2 | 750000 |",
    "",
    "## Sheet: Expenses",
    "| Category | Cost |",
    "|---|---|",
    "| R&D | 200000 |",
    "| Ops | 100000 |",
  ].join("\n"),
  s3Key: "uploads/fin.xlsx",
  sha256: "xlsxsha",
};

describe("TabularDocumentViewer", () => {
  it("renders table headers, rows, and dataset dimensions", () => {
    render(<TabularDocumentViewer source={mockCsvSource} />);

    expect(screen.getByText("Employee Salaries.csv")).toBeTruthy();
    expect(screen.getAllByText(/3 rows/).length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText(/4 columns/)).toBeTruthy();

    expect(screen.getByText("EmployeeId")).toBeTruthy();
    expect(screen.getByText("Alice Smith")).toBeTruthy();
    expect(screen.getByText("Bob Jones")).toBeTruthy();
    expect(screen.getByText("125000")).toBeTruthy();
  });

  it("filters rows dynamically when typing in search input", async () => {
    const user = userEvent.setup();
    render(<TabularDocumentViewer source={mockCsvSource} />);

    const searchInput = screen.getByPlaceholderText("Filter table rows...");
    await user.type(searchInput, "Marketing");

    expect(screen.getByText("Bob Jones")).toBeTruthy();
    expect(screen.queryByText("Alice Smith")).toBeNull();
  });

  it("switches sheets when multi-sheet tabs are clicked", async () => {
    const user = userEvent.setup();
    render(<TabularDocumentViewer source={mockMultiSheetSource} />);

    expect(screen.getByText("Revenue")).toBeTruthy();
    expect(screen.getByText("Expenses")).toBeTruthy();
    expect(screen.getByText("Q1")).toBeTruthy();

    const expensesTab = screen.getByRole("button", { name: /Expenses/ });
    await user.click(expensesTab);

    expect(screen.getByText("Category")).toBeTruthy();
    expect(screen.getByText("R&D")).toBeTruthy();
    expect(screen.queryByText("Q1")).toBeNull();
  });

  it("auto-selects matching sheet when selectedLocator is provided", () => {
    render(
      <TabularDocumentViewer
        source={mockMultiSheetSource}
        selectedLocator={{ sheetName: "Expenses" }}
      />,
    );

    expect(screen.getByText("Category")).toBeTruthy();
    expect(screen.getByText("R&D")).toBeTruthy();
  });
});
