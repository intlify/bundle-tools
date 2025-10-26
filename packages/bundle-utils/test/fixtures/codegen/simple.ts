export default {
  hi: 'hi there!',
  hello: 'hello world!' as string,
  named: `hi, {name} !` as string,
  list: 'hi, {0} !' as string,
  literal: "hi, {  'kazupon'  } !" as string,
  linked: 'hi, @:name !' as string,
  plural: "@.caml:{'no apples'} | {0} apple | {n} apples"
} as Record<string, string>
