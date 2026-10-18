"use client";

import { useRef } from "react";
import { toast } from "sonner";
import { addMilestone, saveProfile, saveRankWeights, saveRatings } from "@/app/(app)/planner/actions";
import { Field } from "@/components/app/field";
import { SubmitButton } from "@/components/app/submit-button";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import { RANK_CRITERIA, DEFAULT_RANK_WEIGHT, type RankWeights } from "@/lib/planner";
import { useOnComplete, useSafeForm } from "@/lib/use-safe-form";

export type Profile = {
  target_roles: string[];
  target_industries: string[];
  target_locations: string[];
  min_salary: number | null;
  salary_currency: string;
  constraints_note: string | null;
};

function Feedback({ state }: { state: { error?: string } | undefined }) {
  return state?.error ? (
    <p role="alert" className="text-sm text-destructive">
      {state.error}
    </p>
  ) : null;
}

export function ProfileForm({ profile }: { profile: Profile }) {
  const form = useSafeForm(saveProfile);
  const { state, onSubmit, pending } = form;
  useOnComplete(form, () => {
    if (state?.message) toast.success(state.message);
  });
  return (
    <form method="post" onSubmit={onSubmit} className="grid gap-3 sm:grid-cols-2">
      <Field label="Roles you're aiming for" htmlFor="p-roles" hint="Separate with commas.">
        <Input id="p-roles" name="target_roles" defaultValue={profile.target_roles.join(", ")} />
      </Field>
      <Field label="Industries" htmlFor="p-ind" hint="Separate with commas.">
        <Input id="p-ind" name="target_industries" defaultValue={profile.target_industries.join(", ")} />
      </Field>
      <Field label="Places or arrangements" htmlFor="p-loc" hint="For example Toronto, remote.">
        <Input id="p-loc" name="target_locations" defaultValue={profile.target_locations.join(", ")} />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Minimum pay (per year)" htmlFor="p-min">
          <Input id="p-min" name="min_salary" inputMode="decimal" defaultValue={profile.min_salary ?? ""} />
        </Field>
        <Field label="Currency" htmlFor="p-cur">
          <Input id="p-cur" name="salary_currency" maxLength={3} defaultValue={profile.salary_currency} className="uppercase" />
        </Field>
      </div>
      <Field label="Constraints or must-haves" htmlFor="p-note" hint="Anything that limits your search, such as visa or location needs, in your own words." className="sm:col-span-2">
        <Textarea id="p-note" name="constraints_note" rows={3} maxLength={2000} defaultValue={profile.constraints_note ?? ""} />
      </Field>
      <div className="flex flex-wrap items-center gap-3 sm:col-span-2">
        <SubmitButton pending={pending}>Save goals</SubmitButton>
        <Feedback state={state} />
      </div>
    </form>
  );
}

export function RankWeightsForm({ weights }: { weights: RankWeights }) {
  const form = useSafeForm(saveRankWeights);
  const { state, onSubmit, pending } = form;
  useOnComplete(form, () => {
    if (state?.message) toast.success(state.message);
  });
  return (
    <form method="post" onSubmit={onSubmit} className="space-y-3">
      <fieldset className="grid gap-3 sm:grid-cols-5">
        <legend className="mb-1 text-sm font-medium">How much does each thing matter? (0 to 10)</legend>
        {RANK_CRITERIA.map((c) => (
          <div key={c.key} className="space-y-1">
            <label htmlFor={`rw-${c.key}`} className="text-sm">
              {c.label}
            </label>
            <Input
              id={`rw-${c.key}`}
              name={`w_${c.key}`}
              type="number"
              min={0}
              max={10}
              defaultValue={weights[c.key] ?? DEFAULT_RANK_WEIGHT}
            />
          </div>
        ))}
      </fieldset>
      <div className="flex flex-wrap items-center gap-3">
        <SubmitButton pending={pending} variant="secondary" size="sm">
          Save weights
        </SubmitButton>
        <Feedback state={state} />
      </div>
    </form>
  );
}

export function RatingsForm({
  applicationId,
  ratings,
  suggestedFit,
}: {
  applicationId: string;
  ratings: Partial<Record<string, number>>;
  suggestedFit: number | null;
}) {
  const form = useSafeForm(saveRatings.bind(null, applicationId));
  const { state, onSubmit, pending } = form;
  const ref = useRef<HTMLFormElement>(null);
  useOnComplete(form, () => {
    if (state?.message) toast.success("Ratings saved");
  });
  return (
    <form ref={ref} method="post" onSubmit={onSubmit} className="space-y-2">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
        {RANK_CRITERIA.map((c) => (
          <div key={c.key} className="space-y-0.5">
            <label htmlFor={`${applicationId}-${c.key}`} className="text-xs text-muted-foreground">
              {c.label}
            </label>
            <NativeSelect id={`${applicationId}-${c.key}`} name={`r_${c.key}`} defaultValue={ratings[c.key] ?? ""} className="h-7 text-xs">
              <option value="">—</option>
              {[1, 2, 3, 4, 5].map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </NativeSelect>
          </div>
        ))}
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <SubmitButton pending={pending} variant="outline" size="sm">
          Save ratings
        </SubmitButton>
        {suggestedFit !== null && ratings.fit === undefined ? (
          <span className="text-xs text-muted-foreground">Your latest resume analysis suggests a fit of {suggestedFit}/5. It&apos;s your call.</span>
        ) : null}
        <Feedback state={state} />
      </div>
    </form>
  );
}

export function AddMilestoneForm() {
  const form = useSafeForm(addMilestone);
  const { state, onSubmit, pending } = form;
  const ref = useRef<HTMLFormElement>(null);
  useOnComplete(form, () => {
    if (!state?.error) {
      ref.current?.reset();
      toast.success("Milestone added");
    }
  });
  return (
    <form ref={ref} method="post" onSubmit={onSubmit} className="grid gap-3 sm:grid-cols-3">
      <Field label="Milestone" htmlFor="m-title" className="sm:col-span-3">
        <Input id="m-title" name="title" required maxLength={200} placeholder="Finish an embedded systems course" />
      </Field>
      <Field label="Skill (optional)" htmlFor="m-skill">
        <Input id="m-skill" name="skill" maxLength={100} />
      </Field>
      <Field label="Target date" htmlFor="m-due">
        <Input id="m-due" name="due_on" type="date" />
      </Field>
      <div className="flex items-end gap-3">
        <SubmitButton pending={pending}>Add milestone</SubmitButton>
      </div>
      <div className="sm:col-span-3">
        <Feedback state={state} />
      </div>
    </form>
  );
}
