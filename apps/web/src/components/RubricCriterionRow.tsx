'use client';

import { useState } from 'react';
import { RubricCriterionEvaluation } from '@hg/shared-schemas';

interface RubricCriterionRowProps {
  criterion: RubricCriterionEvaluation;
}

export function RubricCriterionRow({ criterion }: RubricCriterionRowProps) {
  const [showGuidance, setShowGuidance] = useState(false);

  return (
    <tr style={{ borderBottom: '1px solid #ddd' }}>
      <td style={{ padding: '0.75rem', border: '1px solid #ccc' }}>
        <div>{criterion.label}</div>
        {criterion.guidance && (
          <div style={{ marginTop: '0.5rem' }}>
            <button
              onClick={() => setShowGuidance(!showGuidance)}
              style={{
                fontSize: '0.85em',
                padding: '0.25em 0.5em',
                backgroundColor: 'transparent',
                border: '1px solid #999',
                borderRadius: '3px',
                cursor: 'pointer',
                color: '#555',
              }}
            >
              {showGuidance ? 'Hide' : 'Show'} guidance
            </button>
            {showGuidance && (
              <div
                style={{
                  marginTop: '0.5rem',
                  padding: '0.5rem',
                  backgroundColor: '#f9f9f9',
                  borderRadius: '3px',
                  fontSize: '0.9em',
                  fontStyle: 'italic',
                  color: '#666',
                }}
              >
                {criterion.guidance}
              </div>
            )}
          </div>
        )}
      </td>
      <td style={{ padding: '0.75rem', textAlign: 'center', border: '1px solid #ccc' }}>
        <span
          style={{
            fontSize: '0.85em',
            padding: '0.2em 0.5em',
            backgroundColor: criterion.kind === 'binary' ? '#e3f2fd' : '#f3e5f5',
            borderRadius: '3px',
            fontWeight: 'bold',
          }}
        >
          {criterion.kind}
        </span>
      </td>
      <td style={{ padding: '0.75rem', textAlign: 'center', border: '1px solid #ccc' }}>
        {criterion.maxPoints}
      </td>
      <td style={{ padding: '0.75rem', textAlign: 'center', border: '1px solid #ccc', fontWeight: 'bold' }}>
        {criterion.score}
      </td>
      <td style={{ padding: '0.75rem', border: '1px solid #ccc' }}>
        {criterion.feedback}
      </td>
    </tr>
  );
}

