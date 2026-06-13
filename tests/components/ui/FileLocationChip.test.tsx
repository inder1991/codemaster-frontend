import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";

import { FileLocationChip } from "@/components/ui/FileLocationChip";

describe("FileLocationChip", () => {
  it("short path start===end shows path and single line, no dash", () => {
    render(<FileLocationChip path="a/b.py" startLine={5} endLine={5} />);
    const el = screen.getByTitle("a/b.py");
    expect(el.textContent).toContain("a/b.py");
    expect(el.textContent).toContain("L5");
    expect(el.textContent).not.toContain("-");
  });

  it("long path is middle-truncated and title equals full path", () => {
    render(
      <FileLocationChip
        path="src/x/y/z/auth.py"
        startLine={1}
        endLine={1}
      />,
    );
    const el = screen.getByTitle("src/x/y/z/auth.py");
    expect(el.textContent).toContain("src/");
    expect(el.textContent).toContain(".../");
    expect(el.textContent).toContain("auth.py");
  });

  it("range start!=end shows L<start>-<end>", () => {
    render(<FileLocationChip path="a/b.py" startLine={10} endLine={14} />);
    const el = screen.getByTitle("a/b.py");
    expect(el.textContent).toContain("L10-14");
  });
});
