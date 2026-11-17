package com.staynest.rent.dto;

import java.util.Map;

public class MonthlyReportResponse {
    private String month; // YYYY-MM
    private Long rentBilledPaise;
    private Long rentCollectedPaise;
    private Long otherIncomePaise;
    private Long totalIncomeCollectedPaise;
    private Long totalExpensesPaise;
    private Long outstandingRentPaise;
    private Long operatingSurplusPaise;
    private Long securityDepositsLiabilitiesPaise;
    private Map<String, Long> expenseBreakdownPaise;

    public MonthlyReportResponse() {
    }

    public String getMonth() {
        return month;
    }

    public void setMonth(String month) {
        this.month = month;
    }

    public Long getRentBilledPaise() {
        return rentBilledPaise;
    }

    public void setRentBilledPaise(Long rentBilledPaise) {
        this.rentBilledPaise = rentBilledPaise;
    }

    public Long getRentCollectedPaise() {
        return rentCollectedPaise;
    }

    public void setRentCollectedPaise(Long rentCollectedPaise) {
        this.rentCollectedPaise = rentCollectedPaise;
    }

    public Long getOtherIncomePaise() {
        return otherIncomePaise;
    }

    public void setOtherIncomePaise(Long otherIncomePaise) {
        this.otherIncomePaise = otherIncomePaise;
    }

    public Long getTotalIncomeCollectedPaise() {
        return totalIncomeCollectedPaise;
    }

    public void setTotalIncomeCollectedPaise(Long totalIncomeCollectedPaise) {
        this.totalIncomeCollectedPaise = totalIncomeCollectedPaise;
    }

    public Long getTotalExpensesPaise() {
        return totalExpensesPaise;
    }

    public void setTotalExpensesPaise(Long totalExpensesPaise) {
        this.totalExpensesPaise = totalExpensesPaise;
    }

    public Long getOutstandingRentPaise() {
        return outstandingRentPaise;
    }

    public void setOutstandingRentPaise(Long outstandingRentPaise) {
        this.outstandingRentPaise = outstandingRentPaise;
    }

    public Long getOperatingSurplusPaise() {
        return operatingSurplusPaise;
    }

    public void setOperatingSurplusPaise(Long operatingSurplusPaise) {
        this.operatingSurplusPaise = operatingSurplusPaise;
    }

    public Long getSecurityDepositsLiabilitiesPaise() {
        return securityDepositsLiabilitiesPaise;
    }

    public void setSecurityDepositsLiabilitiesPaise(Long securityDepositsLiabilitiesPaise) {
        this.securityDepositsLiabilitiesPaise = securityDepositsLiabilitiesPaise;
    }

    public Map<String, Long> getExpenseBreakdownPaise() {
        return expenseBreakdownPaise;
    }

    public void setExpenseBreakdownPaise(Map<String, Long> expenseBreakdownPaise) {
        this.expenseBreakdownPaise = expenseBreakdownPaise;
    }
}

