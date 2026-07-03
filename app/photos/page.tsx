import { Camera } from "lucide-react";
import PageHeader from "@/components/ui/PageHeader";
import EmptyState from "@/components/ui/EmptyState";
import PhotoUploadForm from "@/components/photos/PhotoUploadForm";
import DeletePhotoButton from "@/components/photos/DeletePhotoButton";
import { getPhotosData, type PhotoEntry } from "@/lib/queries/tracking";
import { fmtDisplay, localToday } from "@/lib/dates";

export const metadata = { title: "Photos" };
export const dynamic = "force-dynamic";

const ANGLES = [
  { key: "FRONT", label: "Front" },
  { key: "SIDE", label: "Side" },
  { key: "BACK", label: "Back" },
] as const;

function fmt1(v: number): string {
  return Number.isInteger(v) ? String(v) : v.toFixed(1);
}

function EntryCaption({ entry }: { entry: PhotoEntry }) {
  const parts: string[] = [fmtDisplay(entry.date)];
  if (entry.weight != null) parts.push(`${fmt1(entry.weight)} lb`);
  if (entry.bodyFat != null) parts.push(`${fmt1(entry.bodyFat)}% bf`);
  return (
    <div className="mt-2 font-mono text-xs text-text-3">
      {parts.join(" · ")}
      {entry.notes && <span className="text-text-faint"> — {entry.notes}</span>}
    </div>
  );
}

export default async function PhotosPage() {
  const { groups, totalPhotos } = await getPhotosData();
  const today = localToday();

  return (
    <div className="space-y-8">
      <PageHeader title="Photos" subtitle="Monthly progress photos — front, side, back." />

      <PhotoUploadForm defaultDate={today} />

      {totalPhotos === 0 ? (
        <EmptyState
          icon={Camera}
          title="No photos yet."
          body="Same lighting, same time of day, once a month. Future you will thank you."
        />
      ) : (
        <div className="space-y-10">
          {groups.map((group) => (
            <section key={group.monthKey}>
              <h2 className="text-xs font-medium uppercase tracking-wider text-text-3">
                {group.label}
              </h2>
              <div className="mt-3 space-y-8">
                {group.entries.map((entry) => (
                  <div key={entry.date}>
                    <div className="grid max-w-2xl grid-cols-3 gap-2">
                      {ANGLES.map(({ key, label }) => {
                        const photo = entry.photos[key];
                        return photo ? (
                          <div key={key} className="group relative">
                            <DeletePhotoButton
                              photoId={photo.id}
                              label={`${label.toLowerCase()} ${entry.date}`}
                            />
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={photo.filePath}
                              alt={`${label} — ${entry.date}`}
                              loading="lazy"
                              className="aspect-[3/4] w-full rounded-sm border border-border object-cover"
                            />
                            <span className="absolute bottom-1.5 left-1.5 rounded-xs bg-bg/80 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-text-2">
                              {label}
                            </span>
                          </div>
                        ) : (
                          <div
                            key={key}
                            className="grid aspect-[3/4] w-full place-items-center rounded-sm border border-dashed border-border-faint text-[10px] font-medium uppercase tracking-wider text-text-faint"
                          >
                            No {label.toLowerCase()}
                          </div>
                        );
                      })}
                    </div>
                    <EntryCaption entry={entry} />
                  </div>
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
