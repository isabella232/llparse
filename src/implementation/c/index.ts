import * as frontend from 'llparse-frontend';

import {
  ARG_STATE, ARG_POS, ARG_ENDPOS,
  VAR_MATCH,
  CONTAINER_KEY,
} from './constants';
import { Compilation } from './compilation';
import code from './code';
import node from './node';
import { Node } from './node';
import transform from './transform';

export interface ICCompilerOptions {
  readonly debug?: string;
  readonly header?: string;
}

export interface ICPublicOptions {
  readonly header?: string;
}

export class CCompiler {
  constructor(container: frontend.Container,
              public readonly options: ICCompilerOptions) {
    container.add(CONTAINER_KEY, { code, node, transform });
  }

  public compile(info: frontend.IFrontendResult): string {
    const compilation = new Compilation(info.prefix, info.properties);
    const out: string[] = [];

    out.push('#include <stdlib.h>');
    out.push('#include <stdint.h>');
    out.push('#include <string.h>');
    out.push('');
    out.push(`#include "${this.options.header || info.prefix}.h"`);
    out.push(``);

    const root = info.root as frontend.ContainerWrap<frontend.node.Node>;
    const rootState = root.get<Node<frontend.node.Node>>(CONTAINER_KEY)
        .build(compilation);

    compilation.buildGlobals(out);
    out.push('');

    out.push(`int ${info.prefix}_init(${info.prefix}_t* ${ARG_STATE}) {`);
    out.push(`  memset(${ARG_STATE}, 0, sizeof(*${ARG_STATE}));`);
    out.push(`  ${ARG_STATE}->_current = (void*) (intptr_t) ${rootState};`);
    out.push('  return 0;');
    out.push('}');
    out.push('');

    out.push(`static llparse_state_t ${info.prefix}__run(`);
    out.push(`    ${info.prefix}_t* ${ARG_STATE},`);
    out.push(`    const unsigned char* ${ARG_POS},`);
    out.push(`    const unsigned char* ${ARG_ENDPOS}) {`);
    out.push(`  int ${VAR_MATCH};`);
    out.push(`  switch ((llparse_state_t) (intptr_t) ` +
        `${compilation.currentField()}) {`);

    const tmp: string[] = [];
    compilation.buildStates(tmp);
    compilation.indent(out, tmp, '    ');

    out.push('    default:');
    out.push('      /* Unreachable */');
    out.push('      abort();');
    out.push('  }');
    out.push('}');
    out.push('');

    out.push(`int ${info.prefix}_execute(${info.prefix}_t* ${ARG_STATE}, ` +
             `const char* ${ARG_POS}, const char* ${ARG_ENDPOS}) {`);
    out.push('  llparse_state_t next;');
    out.push('');
    out.push(`  next = llparse__run(${ARG_STATE}, ${ARG_POS}, ${ARG_ENDPOS});`);

    // TODO(indutny): lingering errors
    // TODO(indutny): restart spans
    // TODO(indutny): call spans
    // TODO(indutny): return value
    out.push(`  ${ARG_STATE}->_current = (void*) (intptr_t) next;`);
    out.push('  return 0;');
    out.push('}');

    return out.join('\n');
  }
}
