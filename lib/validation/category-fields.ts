// Validation helper for category dynamic fields
// Ensures that all categories have the required minimum_age and maximum_age fields

import type { CategoryField } from "@/lib/types/dynamic-fields"

/**
 * Required fields that must exist for every category
 */
export const REQUIRED_CATEGORY_FIELDS = [
  {
    field_name: "minimum_age",
    field_type: "number" as const,
    field_label: "Minimum Age",
    is_required: false,
    validation_rules: { min: 0, max: 100 },
    placeholder: "e.g., 3",
    help_text: "Minimum age required to participate",
  },
  {
    field_name: "maximum_age",
    field_type: "number" as const,
    field_label: "Maximum Age",
    is_required: false,
    validation_rules: { min: 0, max: 150 },
    placeholder: "e.g., 99",
    help_text: "Maximum age allowed to participate (leave empty for no limit)",
  },
] as const

/**
 * Validates that a category has all required dynamic fields
 * @param categoryFields - Array of fields for a category
 * @returns Object with isValid flag and missing field names
 */
export function validateCategoryFields(categoryFields: CategoryField[]): {
  isValid: boolean
  missingFields: string[]
} {
  const existingFieldNames = new Set(categoryFields.map((f) => f.field_name))
  const missingFields: string[] = []

  for (const requiredField of REQUIRED_CATEGORY_FIELDS) {
    if (!existingFieldNames.has(requiredField.field_name)) {
      missingFields.push(requiredField.field_name)
    }
  }

  return {
    isValid: missingFields.length === 0,
    missingFields,
  }
}

/**
 * Gets the required fields that are missing from a category
 * @param categoryFields - Array of existing fields for a category
 * @returns Array of required field definitions that are missing
 */
export function getMissingRequiredFields(categoryFields: CategoryField[]) {
  const existingFieldNames = new Set(categoryFields.map((f) => f.field_name))
  return REQUIRED_CATEGORY_FIELDS.filter((rf) => !existingFieldNames.has(rf.field_name))
}

/**
 * Checks if a field name is a required category field
 * @param fieldName - The field name to check
 * @returns True if the field is required
 */
export function isRequiredCategoryField(fieldName: string): boolean {
  return REQUIRED_CATEGORY_FIELDS.some((rf) => rf.field_name === fieldName)
}

/**
 * Validates that a field has the correct type for required fields
 * @param fieldName - The field name to validate
 * @param fieldType - The type of the field
 * @returns True if the field type is correct
 */
export function validateRequiredFieldType(fieldName: string, fieldType: string): boolean {
  const requiredField = REQUIRED_CATEGORY_FIELDS.find((rf) => rf.field_name === fieldName)
  if (!requiredField) {
    return true // Not a required field, so type doesn't matter
  }
  return requiredField.field_type === fieldType
}
