// Table-based PDF export with headers and rows
export const exportTableToPDF = (title: string, headers: string[], rows: any[][]) => {
  const printWindow = window.open('', '_blank');
  if (!printWindow) return;

  const tableHTML = `
    <table>
      <thead>
        <tr>${headers.map(h => `<th>${h}</th>`).join('')}</tr>
      </thead>
      <tbody>
        ${rows.map(row => `<tr>${row.map(cell => `<td>${cell ?? '-'}</td>`).join('')}</tr>`).join('')}
      </tbody>
    </table>
  `;

  printWindow.document.write(`
    <!DOCTYPE html>
    <html>
      <head>
        <title>${title}</title>
        <style>
          body { font-family: system-ui, sans-serif; padding: 40px; max-width: 1200px; margin: 0 auto; }
          h1 { font-size: 24px; margin-bottom: 20px; }
          table { width: 100%; border-collapse: collapse; margin-top: 20px; }
          th, td { border: 1px solid #ddd; padding: 8px; text-align: left; font-size: 12px; }
          th { background-color: #f5f5f5; font-weight: 600; }
          tr:nth-child(even) { background-color: #fafafa; }
        </style>
      </head>
      <body>
        <h1>${title}</h1>
        <p>Generated: ${new Date().toLocaleString()}</p>
        ${tableHTML}
      </body>
    </html>
  `);

  printWindow.document.close();
  printWindow.focus();
  setTimeout(() => { printWindow.print(); printWindow.close(); }, 250);
};

// Table-based Excel export with headers and rows
export const exportTableToExcel = (filename: string, headers: string[], rows: any[][]) => {
  const headerRow = headers.join(',');
  const csvRows = rows.map(row => 
    row.map(cell => {
      if (cell === null || cell === undefined) return '';
      let value = String(cell);
      if (value.includes(',') || value.includes('"') || value.includes('\n')) {
        return `"${value.replace(/"/g, '""')}"`;
      }
      return value;
    }).join(',')
  );

  const csvContent = [headerRow, ...csvRows].join('\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  
  const link = document.createElement('a');
  link.href = url;
  link.download = `${filename}.csv`;
  link.click();
  URL.revokeObjectURL(url);
};

// Object-based PDF export for simple data
export const exportToPDF = (data: Record<string, any>[], title: string, filename?: string) => {
  if (data.length === 0) return;
  
  const headers = Object.keys(data[0]);
  const rows = data.map(row => headers.map(key => row[key] ?? '-'));
  
  exportTableToPDF(title, headers, rows);
};

// Object-based Excel export with column mapping
export const exportToExcel = (
  filename: string, 
  data: Record<string, any>[], 
  columns?: { key: string; header: string }[]
) => {
  if (data.length === 0) return;
  
  const headers = columns ? columns.map(c => c.header) : Object.keys(data[0]);
  const keys = columns ? columns.map(c => c.key) : Object.keys(data[0]);
  
  const rows = data.map(row => 
    keys.map(key => row[key])
  );

  exportTableToExcel(filename, headers, rows);
};

// Generate HTML report content for complex reports
export const generateReportHTML = (reportData: {
  summary?: { label: string; value: any }[];
  tableData?: Record<string, any>[];
  columns?: { key: string; header: string }[];
}): string => {
  let html = '';
  
  // Summary section
  if (reportData.summary && reportData.summary.length > 0) {
    html += '<div style="margin-bottom: 30px;"><h2>Summary</h2><div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 15px;">';
    reportData.summary.forEach(item => {
      html += `<div style="padding: 15px; border: 1px solid #ddd; border-radius: 8px;"><div style="font-size: 12px; color: #666;">${item.label}</div><div style="font-size: 20px; font-weight: bold;">${item.value}</div></div>`;
    });
    html += '</div></div>';
  }
  
  // Table section
  if (reportData.tableData && reportData.tableData.length > 0 && reportData.columns) {
    html += '<table style="width: 100%; border-collapse: collapse;"><thead><tr>';
    reportData.columns.forEach(col => {
      html += `<th style="border: 1px solid #ddd; padding: 8px; background: #f5f5f5; text-align: left;">${col.header}</th>`;
    });
    html += '</tr></thead><tbody>';
    
    reportData.tableData.forEach(row => {
      html += '<tr>';
      reportData.columns!.forEach(col => {
        html += `<td style="border: 1px solid #ddd; padding: 8px;">${row[col.key] ?? '-'}</td>`;
      });
      html += '</tr>';
    });
    html += '</tbody></table>';
  }
  
  return html;
};
