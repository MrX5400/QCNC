import re

with open('src/components/Workspace.tsx', 'r', encoding='utf-8') as f:
    ws = f.read()

ws = ws.replace("import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';", "import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';\nimport { ImageTracerLightbox } from './ImageTracerLightbox';")

with open('src/components/Workspace.tsx', 'w', encoding='utf-8') as f:
    f.write(ws)
