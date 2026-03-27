<script setup lang="ts">
interface WorkflowInputDef {
  description?: string;
  required?: boolean;
  default?: string;
  type?: string;
  options?: string[];
}

const props = withDefaults(
  defineProps<{
    inputDefs: Record<string, WorkflowInputDef>;
    modelValue: Record<string, string>;
    lockedInputs?: string[];
    showLockButton?: boolean;
  }>(),
  {
    lockedInputs: () => [],
    showLockButton: false,
  },
);

const emit = defineEmits<{
  "update:modelValue": [value: Record<string, string>];
  "update:lockedInputs": [value: string[]];
}>();

function updateValue(key: string, value: string) {
  emit("update:modelValue", { ...props.modelValue, [key]: value });
}

function getChoiceItems(key: string, def: WorkflowInputDef): Array<{ label: string; value: string }> {
  const options = (def.options || []).map((o) => String(o));
  const currentValue = String(props.modelValue[key] ?? "");
  const items = [...options];
  if (currentValue && !items.includes(currentValue)) {
    items.unshift(currentValue);
  }
  return items.map((option) => ({ label: option, value: option }));
}

function isLocked(key: string): boolean {
  return props.lockedInputs.includes(key);
}

function toggleLock(key: string) {
  const newLockedInputs = isLocked(key)
    ? props.lockedInputs.filter((k) => k !== key)
    : [...props.lockedInputs, key];
  emit("update:lockedInputs", newLockedInputs);
}
</script>

<template>
  <div class="space-y-3">
    <div
      v-for="(def, key) in inputDefs"
      :key="key"
    >
      <label class="block text-sm font-medium mb-1 flex items-center gap-1">
        {{ key }}
        <span
          v-if="def.required"
          class="text-red-500"
        >*</span>
        <UIcon
          v-if="isLocked(key as string) && !showLockButton"
          name="i-lucide-lock"
          class="w-3 h-3 text-warning-500"
        />
      </label>
      <p
        v-if="def.description"
        class="text-xs text-gray-400 mb-1"
      >
        {{ def.description }}
      </p>

      <div class="flex items-center gap-2">
        <USelect
          v-if="def.type === 'choice' && def.options"
          :model-value="modelValue[key]"
          :items="getChoiceItems(key as string, def)"
          value-key="value"
          class="flex-1"
          :disabled="isLocked(key as string) && !showLockButton"
          @update:model-value="updateValue(key, $event)"
        />
        <div
          v-else-if="def.type === 'boolean'"
          class="flex-1 flex items-center"
        >
          <USwitch
            :model-value="modelValue[key] === 'true'"
            :disabled="isLocked(key as string) && !showLockButton"
            @update:model-value="updateValue(key, $event ? 'true' : 'false')"
          />
        </div>
        <UInput
          v-else
          :model-value="modelValue[key]"
          :placeholder="def.default || ''"
          class="flex-1"
          :disabled="isLocked(key as string) && !showLockButton"
          @update:model-value="updateValue(key, $event)"
        />
        <UButton
          v-if="showLockButton"
          :icon="isLocked(key as string) ? 'i-lucide-lock' : 'i-lucide-unlock'"
          :color="isLocked(key as string) ? 'warning' : 'neutral'"
          variant="ghost"
          size="sm"
          @click="toggleLock(key as string)"
        />
      </div>
    </div>
  </div>
</template>
