import { CheckIcon, XIcon } from "lucide-react";

import type { StudentResultRow } from "@/components/chat/shared/types";
import { formatStudentName } from "@/components/chat/shared/display";
import { ResultsTable } from "../ResultsTable";

const gradingTemplate =
  "minmax(10rem,1.6fr) minmax(7rem,0.8fr) minmax(6rem,0.7fr) minmax(6rem,0.7fr) minmax(7rem,0.7fr)";

function testsLabel(student: StudentResultRow) {
  return student.tests
    ? `${student.tests.passed ?? 0}/${student.tests.total ?? 0}`
    : "—";
}

function CompilesStatus({ student }: { student: StudentResultRow }) {
  if (student.compileOk === true) {
    return (
      <span aria-label="Compiles" title="Compiles">
        <CheckIcon className="size-4" strokeWidth={2.2} />
      </span>
    );
  }

  if (student.compileOk === false) {
    return (
      <span aria-label="Does not compile" title="Does not compile">
        <XIcon className="size-4" strokeWidth={2.2} />
      </span>
    );
  }

  return <span>—</span>;
}

function statusLabel(status: string | null) {
  return status ?? "unknown";
}

function statusClassName(status: string | null) {
  if (status === "clean") {
    return "text-[var(--linear-success)]";
  }
  if (status === "banned" || status === "failed") {
    return "text-[var(--linear-danger)]";
  }
  return "text-[var(--chat-text-muted)]";
}

export function GradingTable({
  selectedStudentId,
  setSelectedStudentId,
  students,
}: {
  selectedStudentId: string | null;
  setSelectedStudentId: (id: string | null) => void;
  students: StudentResultRow[];
}) {
  return (
    <ResultsTable
      columns={[
        {
          key: "student",
          label: "Student",
          render: (student) => (
            <span className="block truncate">
              {formatStudentName(student.studentId)}
            </span>
          ),
        },
        {
          key: "status",
          label: "Status",
          render: (student) => (
            <span className={statusClassName(student.status)}>
              {statusLabel(student.status)}
            </span>
          ),
        },
        {
          key: "compiles",
          label: "Compile",
          render: (student) => <CompilesStatus student={student} />,
        },
        {
          key: "tests",
          label: "Tests",
          render: (student) => <span>{testsLabel(student)}</span>,
        },
        {
          key: "banned",
          label: "Banned",
          render: (student) => <span>{student.bannedCount ?? 0}</span>,
        },
      ]}
      onRowSelect={(student) => setSelectedStudentId(student.studentId)}
      rows={students.map((student) => ({ ...student, id: student.studentId }))}
      selectedId={selectedStudentId}
      template={gradingTemplate}
    />
  );
}
