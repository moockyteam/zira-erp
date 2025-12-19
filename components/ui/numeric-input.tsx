"use client"

import type React from "react"

import { Input } from "@/components/ui/input"
import { forwardRef } from "react"

interface NumericInputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "onChange" | "value"> {
  value?: string | number
  onChange?: (e: React.ChangeEvent<HTMLInputElement>) => void
  onValueChange?: (value: string) => void
  decimals?: number
}

/**
 * NumericInput accepts both comma (,) and period (.) as decimal separators
 * Automatically normalizes to period for database storage
 */
const NumericInput = forwardRef<HTMLInputElement, NumericInputProps>(
  ({ value, onChange, onValueChange, decimals = 3, ...props }, ref) => {
    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      let inputValue = e.target.value

      // Replace comma with period for consistency
      inputValue = inputValue.replace(",", ".")

      // Allow negative sign at the start
      if (inputValue.startsWith("-")) {
        inputValue = "-" + inputValue.slice(1).replace(/[^0-9.]/g, "")
      } else {
        // Remove any non-numeric characters except period
        inputValue = inputValue.replace(/[^0-9.]/g, "")
      }

      // Ensure only one decimal point
      const parts = inputValue.split(".")
      if (parts.length > 2) {
        inputValue = parts[0] + "." + parts.slice(1).join("")
      }

      // Update the input value
      e.target.value = inputValue

      if (onChange) {
        onChange(e)
      }

      if (onValueChange) {
        onValueChange(inputValue)
      }
    }

    const handleBlur = (e: React.FocusEvent<HTMLInputElement>) => {
      const val = e.target.value.replace(",", ".")

      // Format on blur if there's a valid number
      if (val && !isNaN(Number(val))) {
        const num = Number(val)
        e.target.value = num.toFixed(decimals)

        if (onValueChange) {
          onValueChange(num.toFixed(decimals))
        }
      }

      if (props.onBlur) {
        props.onBlur(e)
      }
    }

    // Normalize display value (replace comma with period)
    const displayValue = typeof value === "string" ? value.replace(",", ".") : value

    return (
      <Input
        {...props}
        ref={ref}
        type="text"
        inputMode="decimal"
        value={displayValue}
        onChange={handleChange}
        onBlur={handleBlur}
      />
    )
  },
)

NumericInput.displayName = "NumericInput"

export { NumericInput }
