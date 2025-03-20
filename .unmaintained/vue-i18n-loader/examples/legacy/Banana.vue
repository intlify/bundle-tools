<template>
  <form id="fruits">
    <label>{{ $t('select') }}</label>
    <select v-model.number="select">
      <option value="0">0</option>
      <option value="1">1</option>
      <option value="2">2</option>
      <option value="3">3</option>
    </select>
  </form>
  <p>{{ $tc('fruits.banana', select, { n: select }) }}</p>
</template>

<script>
export default {
  name: 'Banana',
  data: () => ({ select: 0 })
}
</script>
