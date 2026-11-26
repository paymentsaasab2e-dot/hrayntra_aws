import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  matchKnownPeopleCommand,
  isPeopleCommand,
  parseCommandDate,
  resolvePendingReply,
} from './ariaCommandMatch.js';

describe('command matcher', () => {
  it('matches undo, cancel and numeric choices', () => {
    assert.equal(matchKnownPeopleCommand('undo').kind, 'undo');
    assert.equal(matchKnownPeopleCommand('take that back').kind, 'undo');
    assert.equal(matchKnownPeopleCommand('cancel').kind, 'cancel');
    assert.equal(matchKnownPeopleCommand('stop').kind, 'cancel');
    assert.deepEqual(matchKnownPeopleCommand('2'), { kind: 'choice', n: 2 });
  });

  it('matches punch with and without a name', () => {
    assert.deepEqual(matchKnownPeopleCommand('punch'), { kind: 'punch', name: '' });
    assert.deepEqual(matchKnownPeopleCommand('punch now'), { kind: 'punch', name: '' });
    assert.equal(matchKnownPeopleCommand('punch Ada').name, 'ada');
    assert.equal(matchKnownPeopleCommand('punch for Theo Tester').name, 'theo tester');
    assert.equal(matchKnownPeopleCommand('punch attendance Ada').name, 'ada');
  });

  it('matches leave decisions including names and oldest', () => {
    assert.deepEqual(matchKnownPeopleCommand('approve leave'), {
      kind: 'leave', decision: 'APPROVED', name: '',
    });
    assert.equal(matchKnownPeopleCommand('approve leave Ada').name, 'ada');
    assert.equal(matchKnownPeopleCommand('approve leave for Ada Lovelace').name, 'ada lovelace');
    assert.equal(matchKnownPeopleCommand('reject leave Theo').decision, 'REJECTED');
    assert.deepEqual(matchKnownPeopleCommand('approve oldest leave'), {
      kind: 'leave', decision: 'APPROVED', oldest: true,
    });
    assert.equal(matchKnownPeopleCommand('reject the oldest leave').decision, 'REJECTED');
  });

  it('matches lock and payroll commands', () => {
    assert.equal(matchKnownPeopleCommand('lock this month').kind, 'lock');
    assert.equal(matchKnownPeopleCommand('lock the month').kind, 'lock');
    assert.equal(matchKnownPeopleCommand('lock attendance').kind, 'lock');
    assert.equal(matchKnownPeopleCommand('run payroll').kind, 'payroll');
    assert.equal(matchKnownPeopleCommand('close this month').kind, 'payroll');
    assert.deepEqual(matchKnownPeopleCommand('approve payroll'), { kind: 'payroll-decide', decision: 'APPROVED' });
    assert.deepEqual(matchKnownPeopleCommand('lock payroll'), { kind: 'payroll-decide', decision: 'LOCKED' });
  });

  it('matches Phase B people commands', () => {
    const apply = matchKnownPeopleCommand('apply leave Ada Annual from 26 Nov 2026 to 28 Nov 2026');
    assert.equal(apply.kind, 'apply-leave');
    assert.equal(apply.blob, 'ada annual');
    assert.equal(matchKnownPeopleCommand('regularise Ada 2026-11-26').kind, 'regularise');
    assert.equal(matchKnownPeopleCommand('regularise Ada 26 Nov 2026').name, 'ada');
    assert.equal(matchKnownPeopleCommand('complete onboarding Ada documents').kind, 'onboarding');
    assert.equal(matchKnownPeopleCommand('join Ada').kind, 'join');
    assert.equal(matchKnownPeopleCommand('defer Ada').kind, 'defer');
    assert.equal(matchKnownPeopleCommand('no show Ada').kind, 'noshow');
    assert.equal(matchKnownPeopleCommand('mark Ada as no-show').kind, 'noshow');
    assert.equal(matchKnownPeopleCommand('start exit Ada').kind, 'exit-start');
    assert.equal(matchKnownPeopleCommand('complete exit for Ada').kind, 'exit-complete');
    assert.deepEqual(
      matchKnownPeopleCommand('assign asset LP-01 to Ada'),
      { kind: 'asset-assign', asset: 'lp-01', name: 'ada' },
    );
    assert.equal(matchKnownPeopleCommand('return asset LP-01').kind, 'asset-return');
    assert.deepEqual(
      matchKnownPeopleCommand('issue letter relieving to Ada'),
      { kind: 'letter', letterType: 'relieving', name: 'ada' },
    );
    assert.deepEqual(matchKnownPeopleCommand('approve inbox'), {
      kind: 'inbox', decision: 'APPROVED', pick: '',
    });
    assert.equal(matchKnownPeopleCommand('approve inbox 2').pick, '2');
    assert.equal(matchKnownPeopleCommand('reject inbox ada').pick, 'ada');
  });

  it('matches Phase C crm commands', () => {
    assert.deepEqual(matchKnownPeopleCommand('create lead Acme'), {
      kind: 'crm', action: 'create_lead', company: 'acme',
    });
    assert.equal(matchKnownPeopleCommand('convert lead Acme').action, 'convert_lead_to_client');
    assert.equal(matchKnownPeopleCommand('update lead Acme status contacted').action, 'update_lead');
    assert.equal(matchKnownPeopleCommand('create client Acme').action, 'create_client');
    const job = matchKnownPeopleCommand('create job Frontend Dev for Acme');
    assert.deepEqual([job.action, job.title, job.client], ['create_job', 'frontend dev', 'acme']);
    const move = matchKnownPeopleCommand('move Ada to Interview on Frontend Dev');
    assert.deepEqual([move.action, move.candidate, move.stage, move.job],
      ['move_candidate_stage', 'ada', 'interview', 'frontend dev']);
    const iv = matchKnownPeopleCommand('schedule interview Ada Frontend Dev on 26 Nov 2026');
    assert.deepEqual([iv.action, iv.blob, iv.date], ['schedule_interview', 'ada frontend dev', '26 nov 2026']);
    assert.equal(matchKnownPeopleCommand('add task Follow up for Theo').action, 'create_task');
    assert.equal(matchKnownPeopleCommand('complete task Follow up').action, 'complete_task');
    assert.equal(matchKnownPeopleCommand('create placement Ada on Frontend Dev').action, 'create_placement');
    assert.equal(matchKnownPeopleCommand('mark Ada joined').action, 'mark_placement_joined');
  });

  it('leaves normal questions for the question path', () => {
    assert.equal(matchKnownPeopleCommand('How many open jobs do we have?'), null);
    assert.equal(matchKnownPeopleCommand('What should I do next?'), null);
    assert.equal(matchKnownPeopleCommand('Summarize business performance'), null);
    assert.equal(matchKnownPeopleCommand('Show schema for placements'), null);
    assert.equal(matchKnownPeopleCommand(''), null);
  });

  it('classifies people commands vs meta/crm kinds', () => {
    assert.equal(isPeopleCommand(matchKnownPeopleCommand('approve leave')), true);
    assert.equal(isPeopleCommand(matchKnownPeopleCommand('punch Ada')), true);
    assert.equal(isPeopleCommand(matchKnownPeopleCommand('undo')), false);
    assert.equal(isPeopleCommand(matchKnownPeopleCommand('create lead Acme')), false);
    assert.equal(isPeopleCommand(null), false);
  });
});

describe('command date parsing', () => {
  it('accepts ISO, d/m/yyyy and month names', () => {
    assert.equal(parseCommandDate('2026-11-26'), '2026-11-26');
    assert.equal(parseCommandDate('26/11/2026'), '2026-11-26');
    assert.equal(parseCommandDate('26 Nov 2026'), '2026-11-26');
    assert.equal(parseCommandDate('Nov 26 2026'), '2026-11-26');
    assert.equal(parseCommandDate('nonsense'), null);
  });
});

describe('pending resolution', () => {
  const options = [
    { n: 1, label: 'Ada Singh', match: 'ada singh', command: { kind: 'punch', employeeId: 'a1' } },
    { n: 2, label: 'Ada Lovelace', match: 'ada lovelace', command: { kind: 'punch', employeeId: 'a2' } },
  ];
  const choicePending = { expects: 'choice', options, prompt: 'Which one?' };

  it('picks by number while a list is open', () => {
    const res = resolvePendingReply(choicePending, '2');
    assert.deepEqual(res, { type: 'command', command: { kind: 'punch', employeeId: 'a2' } });
  });

  it('picks by unique name match', () => {
    const res = resolvePendingReply(choicePending, 'lovelace');
    assert.equal(res.type, 'command');
    assert.equal(res.command.employeeId, 'a2');
  });

  it('reprompts on out-of-range number and ambiguous name', () => {
    assert.equal(resolvePendingReply(choicePending, '9').type, 'reprompt');
    assert.equal(resolvePendingReply(choicePending, 'ada').type, 'reprompt');
  });

  it('cancels on cancel words', () => {
    assert.equal(resolvePendingReply(choicePending, 'cancel').type, 'cancel');
    assert.equal(resolvePendingReply(choicePending, 'no').type, 'cancel');
  });

  it('treats a new command as fresh, clearing the pending choice', () => {
    const res = resolvePendingReply(choicePending, 'approve leave');
    assert.equal(res.type, 'fresh');
    assert.equal(res.command.kind, 'leave');
  });

  it('confirms with yes and reprompts otherwise', () => {
    const pending = { expects: 'confirm', command: { kind: 'join', employeeId: 'e1' }, prompt: 'Join Ada?' };
    assert.deepEqual(resolvePendingReply(pending, 'yes'), {
      type: 'command', command: { kind: 'join', employeeId: 'e1' },
    });
    assert.equal(resolvePendingReply(pending, 'maybe').type, 'reprompt');
    assert.equal(resolvePendingReply(pending, 'no').type, 'cancel');
  });

  it('fills a missing field with the reply text', () => {
    const pending = { expects: 'field', field: 'name', command: { kind: 'punch' }, prompt: 'Who?' };
    const res = resolvePendingReply(pending, 'Ada Lovelace');
    assert.equal(res.type, 'command');
    assert.deepEqual(res.command, { kind: 'punch', name: 'Ada Lovelace' });
  });
});
