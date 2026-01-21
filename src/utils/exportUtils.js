export const escapeCSV = (val) => {
    let s = String(val === null || val === undefined ? '' : val);
    if (s.includes(',') || s.includes('"') || s.includes('\n')) {
        s = '"' + s.replace(/"/g, '""') + '"';
    }
    return s;
};

export const downloadCSVFile = (fileName, headerRow, dataRows) => {
    const csvContent = [
        headerRow.map(h => escapeCSV(h)).join(','),
        ...dataRows.map(row => row.map(val => escapeCSV(val)).join(','))
    ].join('\n');

    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
};
