import type { McpServer } from '@modelcontextprotocol/server';
import { describe, expect, it, vi } from 'vitest';
import { buildLlmsFullTxt, buildLlmsTxt } from '../../src/agent-docs/llms';
import {
  AGENT_TOOL_AREAS,
  AGENT_TOOL_CATALOG,
  MCP_TOOL_NAMES,
  toolsInArea,
} from '../../src/agent-docs/tool-catalog';
import type { McpToolContext } from '../../src/modules/agent-access/mcp/mcp-context';
import { registerAskTools } from '../../src/modules/agent-access/mcp/tools/ask.tools';
import { registerDeleteTools } from '../../src/modules/agent-access/mcp/tools/delete.tools';
import { registerMaterialTools } from '../../src/modules/agent-access/mcp/tools/materials.tools';
import { registerNotebookTools } from '../../src/modules/agent-access/mcp/tools/notebooks.tools';
import { registerSourceTools } from '../../src/modules/agent-access/mcp/tools/sources.tools';

const BASE_URL = 'http://localhost:4000';

function captureRegisteredToolNames(): string[] {
  const names: string[] = [];
  const server = {
    registerTool: vi.fn((name: string) => {
      names.push(name);
    }),
  } as unknown as McpServer;

  const ctx: McpToolContext = {
    era: 'legacy',
    server,
    agentKeyId: 'key_test',
    agentKeyName: 'Test key',
    defaultModel: 'test/model',
    services: {} as McpToolContext['services'],
  };

  registerNotebookTools(server, ctx);
  registerSourceTools(server, ctx);
  registerAskTools(server, ctx);
  registerMaterialTools(server, ctx);
  registerDeleteTools(server, ctx);

  return names;
}

describe('MCP tool catalog', () => {
  it('matches the tools the MCP server registers', () => {
    const registered = captureRegisteredToolNames();

    expect([...registered].sort()).toEqual([...MCP_TOOL_NAMES].sort());
    expect(registered).toHaveLength(MCP_TOOL_NAMES.length);
    expect(new Set(registered).size).toBe(registered.length);
  });

  it('groups every tool into one documented area', () => {
    const catalogNames = AGENT_TOOL_CATALOG.map((tool) => tool.name);

    expect(catalogNames).toEqual(MCP_TOOL_NAMES);
    expect(toolsInArea('Notebooks')).toHaveLength(3);
    expect(toolsInArea('Sources')).toHaveLength(8);
    expect(toolsInArea('Chat')).toHaveLength(1);
    expect(toolsInArea('Study materials')).toHaveLength(6);
    expect(toolsInArea('Deletes')).toHaveLength(5);

    const groupedCount = AGENT_TOOL_AREAS.reduce(
      (total, area) => total + toolsInArea(area).length,
      0,
    );
    expect(groupedCount).toBe(MCP_TOOL_NAMES.length);
  });
});

describe('agent docs builders', () => {
  const builders: Array<[string, (baseUrl: string) => string]> = [
    ['llms.txt', buildLlmsTxt],
    ['llms-full.txt', buildLlmsFullTxt],
  ];

  it.each(builders)(
    '%s lists every tool and the MCP endpoint',
    (_label, build) => {
      const document = build(BASE_URL);

      for (const name of MCP_TOOL_NAMES) {
        expect(document).toContain(name);
      }
      expect(document).toContain(`${BASE_URL}/api/mcp`);
      expect(document).toContain(`${BASE_URL}/api/openapi.json`);
      expect(document).toContain(`${BASE_URL}/api/docs`);
    },
  );

  it('links llms.txt to the full reference', () => {
    expect(buildLlmsTxt(BASE_URL)).toContain(`${BASE_URL}/llms-full.txt`);
  });

  it('trims a trailing slash from the base URL', () => {
    expect(buildLlmsTxt(`${BASE_URL}/`)).toContain(`${BASE_URL}/api/mcp`);
    expect(buildLlmsTxt(`${BASE_URL}/`)).not.toContain(`${BASE_URL}//api/mcp`);
  });
});
