import type { TaskView } from "@/components/crm/ContactPanels";
import { dueLabel } from "./domain";
import { ownerName, rowName, type CrmLoad } from "./load";
import type { ContactFormValues } from "@/components/crm/ContactForm";
import type { Contact, Task } from "./types";

export function taskView(t: Task, c: Pick<CrmLoad, "owners" | "rowById" | "today">): TaskView {
  return {
    id: t.id,
    title: t.title,
    due: t.doneAt ? `faite le ${t.doneAt.slice(8, 10)}/${t.doneAt.slice(5, 7)}` : dueLabel(t.dueOn, c.today),
    dueOn: t.dueOn,
    late: t.dueOn < c.today,
    owner: ownerName(c.owners, t.ownerId),
    contact: t.contactId ? { id: t.contactId, name: rowName(c.rowById, t.contactId) } : null,
    done: !!t.doneAt,
  };
}

export function formValues(c: Contact): ContactFormValues {
  return {
    kind: c.kind,
    firstName: c.firstName,
    lastName: c.lastName,
    company: c.company ?? "",
    job: c.job ?? "",
    email: c.email ?? "",
    phone: c.phone ?? "",
    instagram: c.instagram ?? "",
    city: c.city ?? "",
    source: c.source,
    status: c.status,
    tags: c.tags.join(", "),
    notes: c.notes,
    marketingConsent: c.marketingConsent,
    ownerId: c.ownerId ?? "",
  };
}
