import { Input, NativeSelect } from '@/components/ui/input'
import { cn } from '@/lib/utils'

/** Common dial codes — US first (default). */
export const PHONE_COUNTRIES = [
  { code: 'US', dial: '+1', label: 'United States (+1)' },
  { code: 'CA', dial: '+1', label: 'Canada (+1)' },
  { code: 'GB', dial: '+44', label: 'United Kingdom (+44)' },
  { code: 'AU', dial: '+61', label: 'Australia (+61)' },
  { code: 'IN', dial: '+91', label: 'India (+91)' },
  { code: 'AE', dial: '+971', label: 'UAE (+971)' },
  { code: 'SG', dial: '+65', label: 'Singapore (+65)' },
  { code: 'PH', dial: '+63', label: 'Philippines (+63)' },
  { code: 'NG', dial: '+234', label: 'Nigeria (+234)' },
  { code: 'PK', dial: '+92', label: 'Pakistan (+92)' },
  { code: 'BD', dial: '+880', label: 'Bangladesh (+880)' },
  { code: 'DE', dial: '+49', label: 'Germany (+49)' },
  { code: 'FR', dial: '+33', label: 'France (+33)' },
  { code: 'BR', dial: '+55', label: 'Brazil (+55)' },
  { code: 'MX', dial: '+52', label: 'Mexico (+52)' },
  { code: 'JP', dial: '+81', label: 'Japan (+81)' },
  { code: 'KR', dial: '+82', label: 'South Korea (+82)' },
  { code: 'CN', dial: '+86', label: 'China (+86)' },
] as const

export const DEFAULT_PHONE_COUNTRY = 'US'

export function dialForCountry(countryCode: string): string {
  return PHONE_COUNTRIES.find((c) => c.code === countryCode)?.dial ?? '+1'
}

/** Build E.164-ish mobile string from country + national digits. */
export function composeMobile(countryCode: string, nationalNumber: string): string {
  const dial = dialForCountry(countryCode)
  const digits = nationalNumber.replace(/\D/g, '')
  if (!digits) return ''
  return `${dial}${digits}`
}

export function PhoneInput({
  id = 'mobile',
  countryCode,
  onCountryChange,
  nationalNumber,
  onNationalChange,
  disabled,
  invalid,
  className,
}: {
  id?: string
  countryCode: string
  onCountryChange: (code: string) => void
  nationalNumber: string
  onNationalChange: (value: string) => void
  disabled?: boolean
  invalid?: boolean
  className?: string
}) {
  return (
    <div className={cn('flex gap-2', className)}>
      <NativeSelect
        aria-label="Country code"
        className="w-[9.5rem] shrink-0 sm:w-[11rem]"
        value={countryCode}
        disabled={disabled}
        onChange={(e) => onCountryChange(e.target.value)}
      >
        {PHONE_COUNTRIES.map((c) => (
          <option key={c.code} value={c.code}>
            {c.code} {c.dial}
          </option>
        ))}
      </NativeSelect>
      <Input
        id={id}
        type="tel"
        inputMode="tel"
        autoComplete="tel-national"
        placeholder="Enter your number"
        disabled={disabled}
        aria-invalid={invalid || undefined}
        value={nationalNumber}
        onChange={(e) => onNationalChange(e.target.value.replace(/[^\d\s\-()]/g, ''))}
        className="min-w-0 flex-1"
      />
    </div>
  )
}
