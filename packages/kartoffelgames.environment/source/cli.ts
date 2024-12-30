#!/usr/bin/env -S deno run --allow-write --allow-read --allow-net

import { Command } from "./command.ts";

// create and run command
await new Command().run();;