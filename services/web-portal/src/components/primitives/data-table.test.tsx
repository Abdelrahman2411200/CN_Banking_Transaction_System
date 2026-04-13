import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { DataTable, type DataTableColumn } from "./DataTable";

interface Row {
  id: string;
  status: string;
}

const columns: Array<DataTableColumn<Row>> = [
  { key: "id", header: "ID", render: (row) => row.id },
  { key: "status", header: "Status", render: (row) => row.status }
];

describe("DataTable", () => {
  it("renders loading state", () => {
    render(<DataTable caption="Transfers" columns={columns} getRowKey={(row) => row.id} loading rows={[]} />);

    expect(screen.getByRole("status", { name: /transfers loading/i })).toBeInTheDocument();
  });

  it("renders empty state", () => {
    render(<DataTable caption="Transfers" columns={columns} getRowKey={(row) => row.id} rows={[]} />);

    expect(screen.getByText("No records available")).toBeInTheDocument();
  });

  it("renders row data", () => {
    render(
      <DataTable
        caption="Transfers"
        columns={columns}
        getRowKey={(row) => row.id}
        rows={[{ id: "tx-001", status: "completed" }]}
      />
    );

    expect(screen.getByText("tx-001")).toBeInTheDocument();
    expect(screen.getByText("completed")).toBeInTheDocument();
  });
});
