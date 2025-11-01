"use client"

import { useState } from "react"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Button } from "@/components/ui/button"
import { Upload, X, Loader2 } from "lucide-react"
import { toast } from "sonner"
import type { CategoryField } from "@/lib/types/dynamic-fields"

interface DynamicFormFieldsProps {
  fields: CategoryField[]
  values: Record<string, any>
  onChange: (fieldId: string, value: any, fileUrl?: string) => void
  errors?: Record<string, string>
}

export default function DynamicFormFields({ fields, values, onChange, errors = {} }: DynamicFormFieldsProps) {
  const [uploadingFields, setUploadingFields] = useState<Set<string>>(new Set())

  const handleFileUpload = async (fieldId: string, file: File) => {
    setUploadingFields((prev) => new Set(prev).add(fieldId))

    try {
      const formData = new FormData()
      formData.append("file", file)

      const response = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || "Upload failed")
      }

      const data = await response.json()
      onChange(fieldId, file.name, data.url)
      toast.success("File uploaded successfully")
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Failed to upload file"
      console.error("File upload error:", error)
      toast.error(errorMessage)
    } finally {
      setUploadingFields((prev) => {
        const next = new Set(prev)
        next.delete(fieldId)
        return next
      })
    }
  }

  const validateField = (field: CategoryField, value: any): string | null => {
    if (field.is_required && (!value || value === "")) {
      return `${field.field_label} is required`
    }

    const rules = field.validation_rules

    if (field.field_type === "number" && value) {
      const numValue = parseFloat(value)
      if (rules.min !== undefined && numValue < rules.min) {
        return `${field.field_label} must be at least ${rules.min}`
      }
      if (rules.max !== undefined && numValue > rules.max) {
        return `${field.field_label} must be at most ${rules.max}`
      }
    }

    if (field.field_type === "text" && value) {
      if (rules.minLength !== undefined && value.length < rules.minLength) {
        return `${field.field_label} must be at least ${rules.minLength} characters`
      }
      if (rules.maxLength !== undefined && value.length > rules.maxLength) {
        return `${field.field_label} must be at most ${rules.maxLength} characters`
      }
    }

    return null
  }

  const renderField = (field: CategoryField) => {
    const value = values[field.id] || ""
    const error = errors[field.id] || validateField(field, value)
    const isUploading = uploadingFields.has(field.id)

    const commonProps = {
      id: field.id,
      disabled: isUploading,
    }

    switch (field.field_type) {
      case "text":
        return (
          <Input
            {...commonProps}
            type="text"
            value={value}
            onChange={(e) => onChange(field.id, e.target.value)}
            placeholder={field.placeholder}
          />
        )

      case "textarea":
        return (
          <Textarea
            {...commonProps}
            value={value}
            onChange={(e) => onChange(field.id, e.target.value)}
            placeholder={field.placeholder}
            rows={4}
          />
        )

      case "number":
        return (
          <Input
            {...commonProps}
            type="number"
            value={value}
            onChange={(e) => onChange(field.id, e.target.value)}
            placeholder={field.placeholder}
            min={field.validation_rules.min}
            max={field.validation_rules.max}
          />
        )

      case "select":
        return (
          <Select value={value} onValueChange={(val) => onChange(field.id, val)} disabled={isUploading}>
            <SelectTrigger>
              <SelectValue placeholder={field.placeholder || "Select an option"} />
            </SelectTrigger>
            <SelectContent>
              {field.options.map((option) => (
                <SelectItem key={option} value={option}>
                  {option}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )

      case "checkbox":
        return (
          <div className="flex items-center space-x-2">
            <Checkbox
              id={field.id}
              checked={value === true || value === "true"}
              onCheckedChange={(checked) => onChange(field.id, checked)}
              disabled={isUploading}
            />
            <Label htmlFor={field.id} className="font-normal">
              {field.placeholder || field.field_label}
            </Label>
          </div>
        )

      case "file":
        return (
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Input
                {...commonProps}
                type="file"
                onChange={(e) => {
                  const file = e.target.files?.[0]
                  if (file) {
                    handleFileUpload(field.id, file)
                  }
                }}
                accept="image/*"
                className="hidden"
              />
              <Button
                type="button"
                variant="outline"
                onClick={() => document.getElementById(field.id)?.click()}
                disabled={isUploading}
              >
                {isUploading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Upload className="h-4 w-4 mr-2" />}
                {isUploading ? "Uploading..." : "Upload File"}
              </Button>
              {value && (
                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground truncate max-w-xs">{value}</span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => onChange(field.id, "", "")}
                    disabled={isUploading}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              )}
            </div>
            {values[`${field.id}_url`] && (
              <img
                src={values[`${field.id}_url`]}
                alt="Preview"
                className="w-32 h-32 object-cover rounded border"
              />
            )}
          </div>
        )

      default:
        return <Input {...commonProps} type="text" value={value} onChange={(e) => onChange(field.id, e.target.value)} />
    }
  }

  if (fields.length === 0) {
    return null
  }

  return (
    <div className="space-y-4">
      {fields.map((field) => {
        const error = errors[field.id]

        return (
          <div key={field.id}>
            <Label htmlFor={field.id}>
              {field.field_label}
              {field.is_required && <span className="text-red-500 ml-1">*</span>}
            </Label>
            {renderField(field)}
            {field.help_text && <p className="text-xs text-muted-foreground mt-1">{field.help_text}</p>}
            {error && <p className="text-xs text-red-500 mt-1">{error}</p>}
          </div>
        )
      })}
    </div>
  )
}
