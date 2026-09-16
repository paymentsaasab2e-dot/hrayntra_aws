import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  candidateNameNeedsRepair,
  extractResumeName,
  looksLikePersonName,
} from './cvParsing.service.js';

describe('looksLikePersonName', () => {
  it('accepts real multi-part African / Arabic names', () => {
    assert.equal(looksLikePersonName('Nzouetchou Keutcha Jean Luc Richard'), true);
    assert.equal(looksLikePersonName('Rihab Izzeldin Abd Elmutalib Mukhtar'), true);
    assert.equal(looksLikePersonName('Assanie F. Emilie'), true);
  });

  it('rejects resume headers, locations, and filename junk', () => {
    assert.equal(looksLikePersonName('EXPÉRIENCES PROFESSIONNELLES'), false);
    assert.equal(looksLikePersonName('CURRICULUM VITAE'), false);
    assert.equal(looksLikePersonName('Douala Cameroun'), false);
    assert.equal(looksLikePersonName('Ahmedabad Gujarat India'), false);
    assert.equal(looksLikePersonName('My excellent time management'), false);
    assert.equal(looksLikePersonName('Unknown Candidate'), false);
    assert.equal(looksLikePersonName('AMHZ Consulting'), false);
  });
});

describe('candidateNameNeedsRepair', () => {
  it('does not flag a valid long person name', () => {
    assert.equal(candidateNameNeedsRepair('Nzouetchou', 'Keutcha Jean Luc Richard'), false);
  });

  it('flags filename / location garbage', () => {
    assert.equal(candidateNameNeedsRepair('BBOSA (1)', '(2)'), true);
    assert.equal(candidateNameNeedsRepair('Ahmedabad', 'Gujarat India'), true);
  });
});

describe('extractResumeName', () => {
  it('reads a labeled name from the CV body', () => {
    const text = `Curriculum Vitae\nName: Chetan R. Patel\nEmail: chetan@example.com\nAhmedabad Gujarat India`;
    const name = extractResumeName(text, 'Ahmedabad Gujarat India.pdf');
    assert.equal(name.firstName, 'Chetan');
    assert.match(name.lastName, /Patel/i);
  });

  it('collapses duplicated name tokens from PDF extraction', () => {
    const text = `NAMUGAMBE ROVINE MARY ROVINE MARY\nnamugambe@example.com\nKampala Uganda`;
    const name = extractResumeName(text, 'NAMUGAMBE.pdf');
    assert.equal(name.firstName, 'Namugambe');
    assert.equal(name.lastName, 'Rovine Mary');
  });

  it('does not treat a section header as the candidate name', () => {
    const text = `CURRICULUM VITAE\nEXPÉRIENCES PROFESSIONNELLES\nSoftware Engineer\ninfo@example.com`;
    const name = extractResumeName(text, 'CV ELIE.pdf');
    assert.equal(name.firstName, '');
    assert.equal(name.lastName, '');
  });
});
