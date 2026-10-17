"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { moveApplication } from "@/app/(app)/applications/actions";
import { NativeSelect } from "@/components/ui/native-select";
import { CONSEQUENTIAL_STAGES, STAGES, STAGE_LABEL, type Stage } from "@/lib/domain";

export function StageSelect({ id, stage }: { id: string; stage: Stage }) {
  const [value, setValue] = useState<Stage>(stage);
  const [pending, startTransition] = useTransition();

  function change(next: Stage) {
    if (next === value) return;
    if (CONSEQUENTIAL_STAGES.includes(next) && !window.confirm(`Move this application to ${STAGE_LABEL[next]}?`)) {
      return;
    }
    const previous = value;
    setValue(next);
    startTransition(async () => {
      const result = await moveApplication(id, next);
      if (result?.error) {
        setValue(previous);
        toast.error(result.error);
      }
    });
  }

  return (
    <div className="flex items-center gap-2">
      <label htmlFor="stage-select" className="text-sm text-muted-foreground">
        Stage
      </label>
      <NativeSelect
        id="stage-select"
        value={value}
        disabled={pending}
        onChange={(e) => change(e.target.value as Stage)}
        className="w-40"
      >
        {STAGES.map((s) => (
          <option key={s} value={s}>
            {STAGE_LABEL[s]}
          </option>
        ))}
      </NativeSelect>
    </div>
  );
}
