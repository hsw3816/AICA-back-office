package egovframework.backoffice.verification;

import java.util.Map;
import javax.sql.DataSource;
import org.apache.ibatis.session.SqlSessionFactory;
import org.flywaydb.core.Flyway;
import org.junit.jupiter.api.Test;
import org.mybatis.spring.SqlSessionFactoryBean;
import org.mybatis.spring.SqlSessionTemplate;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.context.annotation.AnnotationConfigApplicationContext;
import org.springframework.context.annotation.Bean;
import org.springframework.core.io.ClassPathResource;
import org.springframework.jdbc.datasource.DataSourceTransactionManager;
import org.springframework.jdbc.datasource.embedded.EmbeddedDatabase;
import org.springframework.jdbc.datasource.embedded.EmbeddedDatabaseBuilder;
import org.springframework.jdbc.datasource.embedded.EmbeddedDatabaseType;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.annotation.EnableTransactionManagement;
import org.springframework.transaction.annotation.Transactional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class Stage0DatabaseTest {
    @Test
    void flywayMyBatisAndSpringTransactionsWorkTogether() {
        try (var context = new AnnotationConfigApplicationContext(ProbeConfiguration.class)) {
            var session = context.getBean(SqlSessionTemplate.class);
            var transaction = context.getBean(ProbeTransaction.class);
            assertThat(context.getBean(Flyway.class).info().applied()).hasSize(1);
            assertThatThrownBy(transaction::writeThenFail)
                    .isInstanceOf(IllegalStateException.class).hasMessage("stage0 rollback");
            assertThat(session.<Integer>selectOne("stage0.Probe.count")).isZero();
            transaction.writeSuccessfully();
            assertThat(session.<String>selectOne("stage0.Probe.value", Map.of("id", 2)))
                    .isEqualTo("committed");
        }
    }

    @TestConfiguration(proxyBeanMethods = false)
    @EnableTransactionManagement
    public static class ProbeConfiguration {
        @Bean(destroyMethod = "shutdown")
        EmbeddedDatabase dataSource() {
            return new EmbeddedDatabaseBuilder().generateUniqueName(true)
                    .setType(EmbeddedDatabaseType.H2).build();
        }

        @Bean
        Flyway flyway(DataSource dataSource) {
            var flyway = Flyway.configure().dataSource(dataSource)
                    .locations("classpath:stage0/db").load();
            flyway.migrate();
            return flyway;
        }

        @Bean(name = {"sqlSessionFactory", "sqlSession"})
        SqlSessionFactory sqlSessionFactory(DataSource dataSource, Flyway flyway) throws Exception {
            var factory = new SqlSessionFactoryBean();
            factory.setDataSource(dataSource);
            factory.setMapperLocations(new ClassPathResource("stage0/mapper/ProbeMapper.xml"));
            return factory.getObject();
        }

        @Bean
        SqlSessionTemplate sqlSessionTemplate(SqlSessionFactory factory) {
            return new SqlSessionTemplate(factory);
        }

        @Bean
        PlatformTransactionManager transactionManager(DataSource dataSource) {
            return new DataSourceTransactionManager(dataSource);
        }

        @Bean
        ProbeTransaction probeTransaction(SqlSessionTemplate session) {
            return new ProbeTransaction(session);
        }
    }

    public static class ProbeTransaction {
        private final SqlSessionTemplate session;
        public ProbeTransaction(SqlSessionTemplate session) { this.session = session; }

        @Transactional
        public void writeThenFail() {
            session.insert("stage0.Probe.insert", Map.of("id", 1, "value", "rollback"));
            throw new IllegalStateException("stage0 rollback");
        }

        @Transactional
        public void writeSuccessfully() {
            session.insert("stage0.Probe.insert", Map.of("id", 2, "value", "committed"));
        }
    }
}
