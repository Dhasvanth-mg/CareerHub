export function UseEvidenceCheckbox({ count }: { count: number }) {
  if (count <= 0) return null;
  return (
    <label className="flex items-start gap-2 text-sm">
      <input type="checkbox" name="use_evidence" value="1" defaultChecked className="mt-1" />
      <span>
        Also use my evidence library
        <span className="block text-xs text-muted-foreground">
          {count} saved item{count === 1 ? "" : "s"} can count as proof, in addition to your resume.
        </span>
      </span>
    </label>
  );
}
