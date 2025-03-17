const val2 = ['hello', 'world']
const val1 = 'hello'

export default {
  val2,
  trueValue: true,
  falseValue: false,
  nullValue: null,
  numberValue: 1,
  regexValue: /abc/,
  funcValue1: function () {},
  funcValue2: () => {},
  identifier: val1,
  items: [
    null,
    1,
    /abc/,
    function () {},
    {
      identifier: val1,
      nullValue: null,
      numberValue: 1,
      regexValue: /abc/
    },
    () => {},
    val1
  ]
}
