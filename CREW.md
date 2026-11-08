# Website studio current crew

[
  {
    "id": "agt_jpba9m28jnc5784pjd876zgdjz",
    "name": "website-studio-ceo",
    "current_version": 25,
    "model": "anthropic/claude-sonnet-5.5",
    "budget": {
      "cap_micro_usd": 50000000,
      "max_task_micro_usd": 15000000,
      "period": "day"
    },
    "multiagent": {
      "type": "coordinator",
      "agents": [
        {
          "type": "agent",
          "id": "agt_yb1hkcq0ntmmb6fbarwszjvp15",
          "version": 3
        },
        {
          "type": "agent",
          "id": "agt_2hfr7xzych9w01s7ptcnv3fn8j",
          "version": 6
        },
        {
          "type": "agent",
          "id": "agt_3trp0jxycntw1xfnep7b3cjng3",
          "version": 3
        }
      ],
      "board": true
    },
    "handoffs": [
      "agt_yb1hkcq0ntmmb6fbarwszjvp15",
      "agt_2hfr7xzych9w01s7ptcnv3fn8j",
      "agt_3trp0jxycntw1xfnep7b3cjng3"
    ]
  },
  {
    "id": "agt_2hfr7xzych9w01s7ptcnv3fn8j",
    "name": "website-studio-designer",
    "current_version": 6,
    "model": "anthropic/claude-sonnet-5.5",
    "budget": {
      "cap_micro_usd": 40000000,
      "max_task_micro_usd": 15000000,
      "period": "day"
    },
    "multiagent": false,
    "handoffs": false
  },
  {
    "id": "agt_yb1hkcq0ntmmb6fbarwszjvp15",
    "name": "website-studio-scout",
    "current_version": 3,
    "model": "z-ai/glm-5.3-flash",
    "budget": {
      "cap_micro_usd": 25000000,
      "max_task_micro_usd": 6000000,
      "period": "day"
    },
    "multiagent": false,
    "handoffs": false
  },
  {
    "id": "agt_3trp0jxycntw1xfnep7b3cjng3",
    "name": "website-studio-qa",
    "current_version": 3,
    "model": "z-ai/glm-5.3-flash",
    "budget": {
      "cap_micro_usd": 15000000,
      "max_task_micro_usd": 5000000,
      "period": "day"
    },
    "multiagent": false,
    "handoffs": false
  }
]

Only one bounded run. No send, paid plans, new agents, recursion or schedules. See RUN_REPORT.md.
