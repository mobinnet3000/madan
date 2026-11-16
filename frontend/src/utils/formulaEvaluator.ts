/**
 * ارزیابی ایمن و سریع فرمول‌های ریاضی تب‌های کارخانه در سمت فرانت‌اند
 * بدون استفاده از eval()
 */

type Token =
  | { type: 'number'; value: number }
  | { type: 'ident'; value: string }
  | { type: 'op'; value: string }
  | { type: 'lparen' }
  | { type: 'rparen' }
  | { type: 'comma' }

function tokenize(expr: string): Token[] {
  const tokens: Token[] = []
  let i = 0
  const s = expr.trim()

  while (i < s.length) {
    const ch = s[i]

    if (/\s/.test(ch)) {
      i++
      continue
    }

    if (ch === '(') {
      tokens.push({ type: 'lparen' })
      i++
      continue
    }
    if (ch === ')') {
      tokens.push({ type: 'rparen' })
      i++
      continue
    }
    if (ch === ',') {
      tokens.push({ type: 'comma' })
      i++
      continue
    }

    if (ch === '+' || ch === '-' || ch === '*' || ch === '/' || ch === '%' || ch === '^') {
      // Check for ** as ^
      if (ch === '*' && s[i + 1] === '*') {
        tokens.push({ type: 'op', value: '^' })
        i += 2
        continue
      }
      tokens.push({ type: 'op', value: ch })
      i++
      continue
    }

    // Number literal
    if (/[0-9.]/.test(ch)) {
      let numStr = ''
      while (i < s.length && /[0-9.]/.test(s[i])) {
        numStr += s[i]
        i++
      }
      const val = Number(numStr)
      if (isNaN(val)) return []
      tokens.push({ type: 'number', value: val })
      continue
    }

    // Identifier (function name or variable)
    if (/[a-zA-Z_]/.test(ch)) {
      let idStr = ''
      while (i < s.length && /[a-zA-Z0-9_.]/.test(s[i])) {
        idStr += s[i]
        i++
      }
      tokens.push({ type: 'ident', value: idStr })
      continue
    }

    // Unknown char, abort
    return []
  }

  return tokens
}

const PRECEDENCE: Record<string, number> = {
  '+': 1,
  '-': 1,
  '*': 2,
  '/': 2,
  '%': 2,
  '^': 3,
  'u-': 4, // Unary minus
  'u+': 4, // Unary plus
}

export function evaluateFormula(formula: string, env: Record<string, number>): number | null {
  if (!formula || !formula.trim()) return null
  const tokens = tokenize(formula)
  if (tokens.length === 0) return null

  // Shunting-yard parser
  const outputQueue: (Token | { type: 'func'; name: string; argCount: number })[] = []
  const opStack: (string | { type: 'func'; name: string })[] = []
  const argCountStack: number[] = []

  let prevToken: Token | null = null

  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i]

    if (token.type === 'number') {
      outputQueue.push(token)
    } else if (token.type === 'ident') {
      // Check if followed by lparen -> function
      if (i + 1 < tokens.length && tokens[i + 1].type === 'lparen') {
        opStack.push({ type: 'func', name: token.value.toLowerCase() })
        argCountStack.push(1)
      } else {
        // Variable lookup
        const val = env[token.value]
        if (val === undefined || val === null || isNaN(val)) {
          return null // Variable not present or invalid
        }
        outputQueue.push({ type: 'number', value: val })
      }
    } else if (token.type === 'op') {
      let op = token.value
      // Check for unary operator
      if (!prevToken || prevToken.type === 'op' || prevToken.type === 'lparen' || prevToken.type === 'comma') {
        if (op === '-') op = 'u-'
        else if (op === '+') op = 'u+'
        else return null
      }

      while (opStack.length > 0) {
        const top = opStack[opStack.length - 1]
        if (typeof top === 'string') {
          const p1 = PRECEDENCE[op] || 0
          const p2 = PRECEDENCE[top] || 0
          if ((op !== '^' && p1 <= p2) || (op === '^' && p1 < p2)) {
            outputQueue.push({ type: 'op', value: opStack.pop() as string })
            continue
          }
        }
        break
      }
      opStack.push(op)
    } else if (token.type === 'comma') {
      while (opStack.length > 0 && opStack[opStack.length - 1] !== '(') {
        const top = opStack.pop()
        if (typeof top === 'string') outputQueue.push({ type: 'op', value: top })
      }
      if (argCountStack.length > 0) {
        argCountStack[argCountStack.length - 1]++
      }
    } else if (token.type === 'lparen') {
      opStack.push('(')
    } else if (token.type === 'rparen') {
      while (opStack.length > 0 && opStack[opStack.length - 1] !== '(') {
        const top = opStack.pop()
        if (typeof top === 'string') outputQueue.push({ type: 'op', value: top })
      }
      if (opStack.length === 0) return null
      opStack.pop() // remove '('

      if (opStack.length > 0 && typeof opStack[opStack.length - 1] === 'object') {
        const func = opStack.pop() as { type: 'func'; name: string }
        const argCount = argCountStack.pop() || 1
        outputQueue.push({ type: 'func', name: func.name, argCount })
      }
    }

    prevToken = token
  }

  while (opStack.length > 0) {
    const top = opStack.pop()
    if (top === '(') return null
    if (typeof top === 'string') outputQueue.push({ type: 'op', value: top })
  }

  // Evaluate RPN
  const evalStack: number[] = []

  for (const item of outputQueue) {
    if (item.type === 'number') {
      evalStack.push(item.value)
    } else if (item.type === 'op') {
      if (item.value === 'u-') {
        if (evalStack.length < 1) return null
        evalStack.push(-evalStack.pop()!)
      } else if (item.value === 'u+') {
        // no-op
      } else {
        if (evalStack.length < 2) return null
        const b = evalStack.pop()!
        const a = evalStack.pop()!
        switch (item.value) {
          case '+': evalStack.push(a + b); break
          case '-': evalStack.push(a - b); break
          case '*': evalStack.push(a * b); break
          case '/':
            if (b === 0) return null // Division by zero
            evalStack.push(a / b)
            break
          case '%':
            if (b === 0) return null
            evalStack.push(a % b)
            break
          case '^': evalStack.push(Math.pow(a, b)); break
          default: return null
        }
      }
    } else if (item.type === 'func') {
      const args: number[] = []
      for (let k = 0; k < item.argCount; k++) {
        if (evalStack.length === 0) return null
        args.unshift(evalStack.pop()!)
      }

      switch (item.name) {
        case 'round': {
          const val = args[0]
          const decimals = args[1] !== undefined ? Math.round(args[1]) : 0
          const factor = Math.pow(10, decimals)
          evalStack.push(Math.round((val + Number.EPSILON) * factor) / factor)
          break
        }
        case 'abs':
          evalStack.push(Math.abs(args[0]))
          break
        case 'min':
          evalStack.push(Math.min(...args))
          break
        case 'max':
          evalStack.push(Math.max(...args))
          break
        case 'sqrt':
          if (args[0] < 0) return null
          evalStack.push(Math.sqrt(args[0]))
          break
        case 'floor':
          evalStack.push(Math.floor(args[0]))
          break
        case 'ceil':
          evalStack.push(Math.ceil(args[0]))
          break
        case 'pow':
          evalStack.push(Math.pow(args[0], args[1]))
          break
        default:
          return null
      }
    }
  }

  if (evalStack.length !== 1) return null
  const res = evalStack[0]
  if (isNaN(res) || !isFinite(res)) return null
  return Math.round((res + Number.EPSILON) * 100) / 100
}

export function computeRowOutputs(
  outputs: { key: string; formula?: string; conditions?: { lines?: number[] } }[],
  inputs: Record<string, any>,
  selectedLineId: number | null
): Record<string, number | null> {
  const env: Record<string, number> = {}

  for (const [k, v] of Object.entries(inputs)) {
    if (v !== '' && v !== null && v !== undefined) {
      const num = Number(v)
      if (!isNaN(num)) {
        env[k] = num
      }
    }
  }

  const results: Record<string, number | null> = {}

  for (const out of outputs) {
    const condLines = out.conditions?.lines
    if (condLines && condLines.length > 0 && (!selectedLineId || !condLines.includes(selectedLineId))) {
      results[out.key] = 0
      env[out.key] = 0
      continue
    }

    if (!out.formula) {
      results[out.key] = null
      continue
    }

    const val = evaluateFormula(out.formula, env)
    results[out.key] = val
    if (val !== null) {
      env[out.key] = val
    }
  }

  return results
}
