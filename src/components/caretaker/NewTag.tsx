// Small red count tag ("3") shown next to a link or button when something new is waiting.
export function NewTag({ count }: { count: number }) {
  if (!count) return null;
  return (
    <span
      title={`${count} new`}
      className="ml-1.5 inline-flex min-w-[18px] items-center justify-center rounded-full bg-[#AE4328] px-1.5 text-[10.5px] font-bold leading-[18px] text-white"
    >
      {count}
    </span>
  );
}
