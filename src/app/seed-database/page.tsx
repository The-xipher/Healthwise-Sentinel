
'use client';

import * as React from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Loader2, CheckCircle, AlertTriangle, Database } from 'lucide-react';
import { seedDatabaseAction } from '@/app/actions/seedActions';

export default function SeedDatabasePage() {
  const [isLoading, setIsLoading] = React.useState(false);
  const [statusMessage, setStatusMessage] = React.useState<string | null>(null);
  const [isError, setIsError] = React.useState(false);

  const handleSeedDatabase = async () => {
    setIsLoading(true);
    setStatusMessage('Seeding database, please wait...');
    setIsError(false);

    try {
      const result = await seedDatabaseAction();
      if (result.success) {
        setStatusMessage(result.message);
        setIsError(false);
      } else {
        setStatusMessage(result.message + (result.error ? ` Error: ${result.error}` : ''));
        setIsError(true);
      }
    } catch (error: any) {
      setStatusMessage(`An unexpected error occurred: ${error.message || String(error)}`);
      setIsError(true);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="container mx-auto p-4 md:p-8 flex justify-center items-start min-h-screen">
      <Card className="w-full max-w-lg shadow-xl">
        <CardHeader>
          <CardTitle className="flex items-center text-2xl">
            <Database className="mr-2 h-6 w-6" />
            Seed Database
          </CardTitle>
          <CardDescription>
            Populate the database with mock data for testing and demonstration purposes.
            This will clear existing data in relevant collections.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <Button
            onClick={handleSeedDatabase}
            disabled={isLoading}
            className="w-full text-lg py-6"
            size="lg"
          >
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                Seeding...
              </>
            ) : (
              'Seed Mock Data'
            )}
          </Button>

          {statusMessage && (
            <Alert variant={isError ? 'destructive' : 'default'} className={!isError ? 'bg-green-50 border-green-200 dark:bg-green-900 dark:border-green-700' : ''}>
              {isError ? <AlertTriangle className="h-4 w-4" /> : <CheckCircle className="h-4 w-4" />}
              <AlertTitle>{isError ? 'Error' : 'Status'}</AlertTitle>
              <AlertDescription className={!isError ? 'text-green-700 dark:text-green-200' : ''}>
                {statusMessage}
              </AlertDescription>
            </Alert>
          )}
           <Alert variant="default" className="mt-4">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>Important Note</AlertTitle>
            <AlertDescription>
              Running this script will first <strong>delete all existing data</strong> in the
              `users`, `healthData`, `medications`, `symptomReports`, `aiSuggestions`, and `chatMessages` collections before inserting new mock data.
              Use with caution, especially in environments with valuable data.
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    </div>
  );
}
