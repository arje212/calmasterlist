import React from 'react';
import { Download, FileSpreadsheet, FileText, Printer } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { downloadCSV, downloadExcel, printTable } from '@/lib/exporters';

// getData: () => ({ title, filename, columns, rows })
export default function ExportMenu({ getData, label = 'Export' }) {
  const run = (fn) => {
    const { title, filename, columns, rows } = getData();
    if (fn === 'csv') downloadCSV(filename, columns, rows);
    if (fn === 'xls') downloadExcel(filename, columns, rows);
    if (fn === 'print') printTable(title, columns, rows);
  };
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" className="gap-2"><Download className="h-4 w-4" />{label}</Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-52">
        <DropdownMenuItem onClick={() => run('xls')}><FileSpreadsheet className="h-4 w-4 mr-2" />Excel (.xls)</DropdownMenuItem>
        <DropdownMenuItem onClick={() => run('csv')}><FileText className="h-4 w-4 mr-2" />CSV</DropdownMenuItem>
        <DropdownMenuItem onClick={() => run('print')}><Printer className="h-4 w-4 mr-2" />Print / Save as PDF</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}