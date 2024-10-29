import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as kms from 'aws-cdk-lib/aws-kms';
import * as backup from 'aws-cdk-lib/aws-backup';
import * as iam from 'aws-cdk-lib/aws-iam';

export class CdkAwsBackupStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const backupRole = new iam.Role(this, 'AWSBackupRole', {
      roleName: 'mybackupOperator',
      assumedBy: new iam.ServicePrincipal('backup.amazonaws.com'),
    });

    const passRolePolicy = new iam.Policy(this, 'AWSBackupPassRolePolicy', {
      policyName: 'aws-backup-passrole',
      statements: [
        new iam.PolicyStatement({
          effect: iam.Effect.ALLOW,
          actions: [
            'iam:GetRole',
            'iam:PassRole'
          ],
          resources: [`arn:aws:iam::${cdk.Stack.of(this).account}:role/*`]
        })
      ]
    });

    backupRole.attachInlinePolicy(passRolePolicy);

    backupRole.addManagedPolicy(
      iam.ManagedPolicy.fromAwsManagedPolicyName('service-role/AWSBackupServiceRolePolicyForBackup')
    );

    backupRole.addManagedPolicy(
      iam.ManagedPolicy.fromAwsManagedPolicyName('service-role/AWSBackupServiceRolePolicyForRestores')
    );

    const backupKey = new kms.Key(this, 'BackupEncryptionKey', {
      description: 'KMS key for AWS Backup encryption',
      enableKeyRotation: true,
      enabled: true,
      alias: 'alias/my-backup-key',
      removalPolicy: cdk.RemovalPolicy.RETAIN,
      policy: new cdk.aws_iam.PolicyDocument({
        statements: [
          new cdk.aws_iam.PolicyStatement({
            sid: 'Allow central account encryption key usage',
            effect: cdk.aws_iam.Effect.ALLOW,
            principals: [
              new cdk.aws_iam.AccountRootPrincipal()
            ],
            actions: ['kms:*'],
            resources: ['*']
          })
        ]
      })
    });

    const backupVault = new backup.BackupVault(this, 'rMyVault', {
      backupVaultName: 'my-backup-vault',
      encryptionKey: backupKey,
      removalPolicy: cdk.RemovalPolicy.RETAIN
    });

    const weeklyBackupPlan = new backup.CfnBackupPlan(this, 'rWeeklyBackupPlan', {
      backupPlan: {
        backupPlanName: 'Weekly',
        backupPlanRule: [{
          ruleName: 'WeeklyBackups',
          targetBackupVault: backupVault.backupVaultName,
          lifecycle: {
            deleteAfterDays: 90
          },

          scheduleExpression: 'cron(0 5 ? * 7 *)',
          startWindowMinutes: 480,
          completionWindowMinutes: 10080
        }],
      }
    });

   const weeklyBackupPlanSelector = new backup.CfnBackupSelection (this, 'rWeeklyBackupPlanSelector', {
      backupPlanId: weeklyBackupPlan.attrBackupPlanId,
      backupSelection: {
        selectionName: 'Weekly-Backups',
        iamRoleArn: backupRole.roleArn,
        listOfTags: [{
          conditionType: 'STRINGEQUALS',
          conditionKey: 'Backup-Weekly',
          conditionValue: 'true'
        }]
      }
    });

    const dailyBackupPlan = new backup.CfnBackupPlan(this, 'rDailyBackupPlan', {
      backupPlan: {
        backupPlanName: 'Daily',
        backupPlanRule: [{
          ruleName: 'DailyBackups',
          targetBackupVault: backupVault.backupVaultName,
          lifecycle: {
            deleteAfterDays: 30
          },
          scheduleExpression: 'cron(0 5 * * ? *)',
          startWindowMinutes: 480,
          completionWindowMinutes: 10080
        }],
      }
    });

    const dailyBackupSelector = new backup.CfnBackupSelection(this, 'rDailyBackupSelector', {
      backupPlanId: dailyBackupPlan.attrBackupPlanId,
      backupSelection: {
        selectionName: 'Daily-Backups',
        iamRoleArn: backupRole.roleArn,
        listOfTags: [{
          conditionType: 'STRINGEQUALS',
          conditionKey: 'Backup-Daily',
          conditionValue: 'true'
        }]
      }
    });

    const monthlyBackupPlan = new backup.CfnBackupPlan(this, 'rMonthlyBackupPlan', {
      backupPlan: {
        backupPlanName: 'Monthly',
        backupPlanRule: [{
          ruleName: 'MonthlyBackups',
          targetBackupVault: backupVault.backupVaultName,
          lifecycle: {
            deleteAfterDays: 365,
            moveToColdStorageAfterDays: 180,
            optInToArchiveForSupportedResources: true,
          },
          scheduleExpression: 'cron(0 5 1 * ? *)',
          startWindowMinutes: 480,
          completionWindowMinutes: 10080
        }],
      }
    });

    const monthlyBackupPlanSelector = new backup.CfnBackupSelection(this, 'rMonthlyBackupPlanSelector', {
      backupPlanId: monthlyBackupPlan.attrBackupPlanId,
      backupSelection: {
        selectionName: 'Monthly-Backups',
        iamRoleArn: backupRole.roleArn,
        listOfTags: [{
          conditionType: 'STRINGEQUALS',
          conditionKey: 'Backup-Monthly',
          conditionValue: 'true'
        }]
      }
    });
  }
}
