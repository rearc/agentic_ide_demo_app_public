import { PlusSquareIcon } from '@phosphor-icons/react'

export default function PlaceholderCard() {
  return (
    <div className="h-full flex flex-col items-center justify-center text-center border border-dashed border-hairline-strong p-6">
      <PlusSquareIcon
        size={26}
        className="mb-2 text-text-secondary"
        aria-hidden
      />
      <p className="text-base font-semibold">What should we build here?</p>
      <p className="text-text-secondary text-[13px] mt-1">
        Pick a widget and we&apos;ll add it live
      </p>
    </div>
  )
}
