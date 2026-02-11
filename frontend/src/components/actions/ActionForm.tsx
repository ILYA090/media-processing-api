import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import type { Action, JsonSchemaProperty } from '@/types';

interface ActionFormProps {
  action: Action;
  onSubmit: (parameters: object) => void;
  isLoading: boolean;
}

// Fields that should be conditionally visible based on mode
const CONDITIONAL_FIELDS: Record<string, Record<string, string[]>> = {
  img_resize: {
    percentage: ['percentage'],
    pixels: ['width', 'height'],
  },
};

export function ActionForm({ action, onSubmit, isLoading }: ActionFormProps) {
  const { inputSchema } = action;
  const [formValues, setFormValues] = useState<Record<string, any>>({});

  // Initialize form with defaults
  useEffect(() => {
    const defaults: Record<string, any> = {};
    if (inputSchema?.properties) {
      Object.entries(inputSchema.properties).forEach(([key, prop]) => {
        if ((prop as JsonSchemaProperty).default !== undefined) {
          defaults[key] = (prop as JsonSchemaProperty).default;
        }
      });
    }
    setFormValues(defaults);
  }, [action]);

  const handleChange = (key: string, value: any) => {
    setFormValues((prev) => ({ ...prev, [key]: value }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // Filter out fields not relevant to current mode
    const filtered = { ...formValues };
    const conditionalConfig = CONDITIONAL_FIELDS[action.actionId];
    if (conditionalConfig) {
      const modeValue = filtered.mode;
      if (modeValue && conditionalConfig[modeValue]) {
        const visibleFields = conditionalConfig[modeValue];
        const allConditionalFields = Object.values(conditionalConfig).flat();
        for (const field of allConditionalFields) {
          if (!visibleFields.includes(field)) {
            delete filtered[field];
          }
        }
      }
    }
    onSubmit(filtered);
  };

  const isFieldVisible = (key: string): boolean => {
    const conditionalConfig = CONDITIONAL_FIELDS[action.actionId];
    if (!conditionalConfig) return true;

    const allConditionalFields = Object.values(conditionalConfig).flat();
    if (!allConditionalFields.includes(key)) return true;

    const modeValue = formValues.mode;
    if (!modeValue) return true;

    const visibleForMode = conditionalConfig[modeValue] || [];
    return visibleForMode.includes(key);
  };

  const renderField = (key: string, property: JsonSchemaProperty) => {
    if (!isFieldVisible(key)) return null;

    const isRequired = inputSchema.required?.includes(key);
    const value = formValues[key] ?? property.default ?? '';

    // Select field (enum)
    if (property.enum) {
      return (
        <Select
          key={key}
          label={`${property.title || key}${isRequired ? ' *' : ''}`}
          value={value}
          onChange={(e) => handleChange(key, e.target.value)}
          options={property.enum.map((opt: string) => ({
            value: opt,
            label: opt.charAt(0).toUpperCase() + opt.slice(1).replace(/_/g, ' '),
          }))}
          hint={property.description}
        />
      );
    }

    // Boolean (checkbox)
    if (property.type === 'boolean') {
      return (
        <label key={key} className="flex items-center gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={value === true}
            onChange={(e) => handleChange(key, e.target.checked)}
            className="w-4 h-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
          />
          <span className="text-sm font-medium text-gray-700">
            {property.title || key}
          </span>
          {property.description && (
            <span className="text-sm text-gray-500">({property.description})</span>
          )}
        </label>
      );
    }

    // Number input
    if (property.type === 'integer' || property.type === 'number') {
      return (
        <Input
          key={key}
          type="number"
          label={`${property.title || key}${isRequired ? ' *' : ''}`}
          value={value}
          onChange={(e) => handleChange(key, parseFloat(e.target.value) || 0)}
          min={property.minimum}
          max={property.maximum}
          hint={property.description}
          required={isRequired}
        />
      );
    }

    // Text input (default)
    return (
      <Input
        key={key}
        type="text"
        label={`${property.title || key}${isRequired ? ' *' : ''}`}
        value={value}
        onChange={(e) => handleChange(key, e.target.value)}
        hint={property.description}
        required={isRequired}
      />
    );
  };

  const properties = inputSchema?.properties || {};
  const requiredFields = inputSchema?.required || [];

  // Separate fields: required first, then optional (excluding hidden conditional fields)
  const allKeys = Object.keys(properties);
  const requiredKeys = allKeys.filter((key) => requiredFields.includes(key));
  const optionalKeys = allKeys.filter((key) => !requiredFields.includes(key));

  // Filter visible optional fields
  const visibleOptionalKeys = optionalKeys.filter((key) => isFieldVisible(key));

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Required Fields */}
      {requiredKeys.length > 0 && (
        <div className="space-y-4">
          {requiredKeys.map((key) =>
            renderField(key, properties[key] as JsonSchemaProperty)
          )}
        </div>
      )}

      {/* Optional Fields */}
      {visibleOptionalKeys.length > 0 && (
        <div className="space-y-4">
          <details className="group" open={requiredKeys.length === 0}>
            <summary className="text-sm font-medium text-gray-700 cursor-pointer list-none flex items-center gap-2">
              <span className="transition-transform group-open:rotate-90">&#9654;</span>
              {requiredKeys.length === 0 ? 'Parameters' : `Optional Parameters (${visibleOptionalKeys.length})`}
            </summary>
            <div className="mt-4 space-y-4 pl-4 border-l-2 border-gray-200">
              {visibleOptionalKeys.map((key) =>
                renderField(key, properties[key] as JsonSchemaProperty)
              )}
            </div>
          </details>
        </div>
      )}

      <div className="flex justify-end pt-4 border-t">
        <Button type="submit" loading={isLoading}>
          Process
        </Button>
      </div>
    </form>
  );
}
