'use client';

import { useState } from 'react';
import { RubricCriterionEvaluation } from '@hg/shared-schemas';
import { TableCell, TableRow } from './ui/table';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { cn } from '../lib/utils';

interface RubricCriterionRowProps {
  criterion: RubricCriterionEvaluation;
}

export function RubricCriterionRow({ criterion }: RubricCriterionRowProps) {
  const [showGuidance, setShowGuidance] = useState(false);

  return (
    <TableRow>
      <TableCell>
        <div>{criterion.label}</div>
        {criterion.guidance && (
          <div className="mt-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowGuidance(!showGuidance)}
              className="h-auto py-1 px-2 text-xs"
            >
              {showGuidance ? 'Hide' : 'Show'} guidance
            </Button>
            {showGuidance && (
              <div className="mt-2 p-2 bg-gray-50 rounded text-sm italic text-gray-600">
                {criterion.guidance}
              </div>
            )}
          </div>
        )}
      </TableCell>
      <TableCell className="text-center">
        <Badge variant={criterion.kind === 'binary' ? 'default' : 'secondary'} className="text-xs">
          {criterion.kind}
        </Badge>
      </TableCell>
      <TableCell className="text-center">
        {criterion.maxPoints}
      </TableCell>
      <TableCell className="text-center font-bold">
        {criterion.score}
      </TableCell>
      <TableCell>
        {/* {criterion.feedback} */}
      </TableCell>
    </TableRow>
  );
}
