import { useReference, type Place } from '../api';

export interface AreaPickerProps {
  /** Location ids already chosen (city or locality). */
  selected: readonly string[];
}

/**
 * Checkboxes named `locationIds`: one per city ("All of Mohali") and one per locality, grouped by
 * city. The form reads them with `getAll`, so no state lives here.
 */
export function AreaPicker({ selected }: AreaPickerProps) {
  const reference = useReference();
  const places = (reference.data?.locations ?? []).filter((p) => p.isActive);
  const cities = places.filter((p) => p.type === 'city');
  const localitiesOf = (city: Place) =>
    places.filter((p) => p.type === 'locality' && p.parentId === city.id);
  const chosen = new Set(selected);

  if (reference.isPending) return <p className="text-sm text-zinc-500">Loading areas…</p>;
  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="mb-1 text-sm font-medium text-zinc-700">Areas you serve</legend>
      {cities.map((city) => {
        const localities = localitiesOf(city);
        const open = chosen.has(city.id) || localities.some((l) => chosen.has(l.id));
        return (
          <details
            key={city.id}
            open={open}
            className="rounded-lg border border-zinc-200 px-3 py-2"
          >
            <summary className="cursor-pointer py-1 text-sm font-medium">{city.name}</summary>
            <div className="mt-2 grid grid-cols-1 gap-x-4 sm:grid-cols-2 lg:grid-cols-3">
              <label className="col-span-full flex items-center gap-2 py-1.5 text-sm">
                <input
                  type="checkbox"
                  className="size-4"
                  name="locationIds"
                  value={city.id}
                  defaultChecked={chosen.has(city.id)}
                />
                All of {city.name}
              </label>
              {localities.map((locality) => (
                <label key={locality.id} className="flex items-center gap-2 py-1.5 text-sm">
                  <input
                    type="checkbox"
                    className="size-4"
                    name="locationIds"
                    value={locality.id}
                    defaultChecked={chosen.has(locality.id)}
                  />
                  {locality.name}
                </label>
              ))}
            </div>
          </details>
        );
      })}
    </fieldset>
  );
}
